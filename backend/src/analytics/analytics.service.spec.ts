import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { AnalyticsRange } from './dto/analytics-query.dto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  review: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  issue: {
    findMany: jest.fn(),
  },
  teamMember: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

// ── Factories ────────────────────────────────────────────────────────────────

function makeReview(overrides: Partial<any> = {}): any {
  return {
    id: 'review-1',
    userId: 'user-1',
    language: 'typescript',
    status: 'COMPLETED',
    overallScore: 85,
    createdAt: new Date('2024-01-15T00:00:00Z'),
    ...overrides,
  };
}

function makeIssue(overrides: Partial<any> = {}): any {
  return {
    category: 'QUALITY',
    severity: 'MEDIUM',
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ── getPersonalStats() ────────────────────────────────────────────────────

  describe('getPersonalStats()', () => {
    it('returns correct review totals', async () => {
      mockPrisma.review.count
        .mockResolvedValueOnce(42) // totalReviews
        .mockResolvedValueOnce(7); // thisMonthReviews
      mockPrisma.review.findMany.mockResolvedValue([
        makeReview({ id: 'r1', overallScore: 80 }),
        makeReview({ id: 'r2', overallScore: 90 }),
      ]);
      mockPrisma.issue.findMany.mockResolvedValue([]);

      const stats = await service.getPersonalStats('user-1', AnalyticsRange.MONTH);

      expect(stats.totalReviews).toBe(42);
      expect(stats.thisMonthReviews).toBe(7);
      expect(stats.range).toBe(AnalyticsRange.MONTH);
      expect(stats.completedReviews).toBe(2);
      expect(stats.averageScore).toBe(85); // (80 + 90) / 2
    });

    it('groups issues by category correctly', async () => {
      mockPrisma.review.count.mockResolvedValue(0);
      mockPrisma.review.findMany.mockResolvedValue([makeReview({ id: 'r1' })]);
      mockPrisma.issue.findMany.mockResolvedValue([
        makeIssue({ category: 'SECURITY', severity: 'CRITICAL' }),
        makeIssue({ category: 'SECURITY', severity: 'HIGH' }),
        makeIssue({ category: 'PERFORMANCE', severity: 'MEDIUM' }),
        makeIssue({ category: 'QUALITY', severity: 'LOW' }),
      ]);

      const stats = await service.getPersonalStats('user-1', AnalyticsRange.MONTH);

      expect(stats.issuesByCategory.SECURITY).toBe(2);
      expect(stats.issuesByCategory.PERFORMANCE).toBe(1);
      expect(stats.issuesByCategory.QUALITY).toBe(1);
      expect(stats.issuesByCategory.STYLE).toBe(0);
      expect(stats.issuesByCategory.DEPENDENCIES).toBe(0);

      expect(stats.issuesBySeverity.CRITICAL).toBe(1);
      expect(stats.issuesBySeverity.HIGH).toBe(1);
      expect(stats.issuesBySeverity.MEDIUM).toBe(1);
      expect(stats.issuesBySeverity.LOW).toBe(1);
    });

    it('respects the date range filter', async () => {
      mockPrisma.review.count.mockResolvedValue(0);
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.issue.findMany.mockResolvedValue([]);

      await service.getPersonalStats('user-1', AnalyticsRange.WEEK);

      // The range-scoped findMany should pass a `createdAt: { gte: <cutoff> }`
      // where cutoff is about 7 days ago.
      const call = mockPrisma.review.findMany.mock.calls[0][0];
      const gte = call.where.createdAt.gte as Date;
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      // Allow a 1-day slack to cover the setHours(0, 0, 0, 0) clamp + test runtime
      expect(gte.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo - 24 * 60 * 60 * 1000);
      expect(gte.getTime()).toBeLessThanOrEqual(now);
    });

    it('returns cached result on second call without hitting the DB', async () => {
      const cached = {
        range: AnalyticsRange.MONTH,
        totalReviews: 99,
        thisMonthReviews: 9,
        completedReviews: 9,
        averageScore: 80,
        issuesByCategory: {
          SECURITY: 0, PERFORMANCE: 0, QUALITY: 0, STYLE: 0,
          DOCUMENTATION: 0, TESTING: 0, DEPENDENCIES: 0,
        },
        issuesBySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        scoreTrend: [],
        languages: [],
      };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getPersonalStats('user-1', AnalyticsRange.MONTH);

      expect(result).toEqual(cached);
      expect(mockPrisma.review.count).not.toHaveBeenCalled();
      expect(mockPrisma.review.findMany).not.toHaveBeenCalled();
    });

    it('returns score trend points only for COMPLETED reviews with a score', async () => {
      mockPrisma.review.count.mockResolvedValue(0);
      mockPrisma.review.findMany.mockResolvedValue([
        makeReview({ id: 'r1', status: 'COMPLETED', overallScore: 80 }),
        makeReview({ id: 'r2', status: 'FAILED',    overallScore: null }),
        makeReview({ id: 'r3', status: 'PENDING',   overallScore: null }),
        makeReview({ id: 'r4', status: 'COMPLETED', overallScore: 95 }),
      ]);
      mockPrisma.issue.findMany.mockResolvedValue([]);

      const stats = await service.getPersonalStats('user-1', AnalyticsRange.MONTH);

      expect(stats.scoreTrend).toHaveLength(2);
      expect(stats.scoreTrend[0].score).toBe(80);
      expect(stats.scoreTrend[1].score).toBe(95);
    });

    it('aggregates languages and sorts by count desc', async () => {
      mockPrisma.review.count.mockResolvedValue(0);
      mockPrisma.review.findMany.mockResolvedValue([
        makeReview({ id: 'r1', language: 'typescript' }),
        makeReview({ id: 'r2', language: 'python' }),
        makeReview({ id: 'r3', language: 'typescript' }),
        makeReview({ id: 'r4', language: 'typescript' }),
        makeReview({ id: 'r5', language: 'go' }),
      ]);
      mockPrisma.issue.findMany.mockResolvedValue([]);

      const stats = await service.getPersonalStats('user-1', AnalyticsRange.MONTH);

      expect(stats.languages[0]).toEqual({ language: 'typescript', count: 3 });
      expect(stats.languages[1].count).toBeLessThanOrEqual(3);
    });

    it('caches the computed result with the short query TTL', async () => {
      mockPrisma.review.count.mockResolvedValue(0);
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.issue.findMany.mockResolvedValue([]);

      await service.getPersonalStats('user-1', AnalyticsRange.MONTH);

      expect(mockCache.set).toHaveBeenCalledWith(
        'analytics:personal:user-1:30d',
        expect.any(Object),
        expect.any(Number),
      );
    });
  });

  // ── getTeamStats() ────────────────────────────────────────────────────────

  describe('getTeamStats()', () => {
    it('throws NotFoundException when user has no team membership', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      await expect(
        service.getTeamStats('lonely-user', AnalyticsRange.MONTH),
      ).rejects.toThrow(NotFoundException);
    });

    it('aggregates reviews across all team members in the range', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: 'team-1' });
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: { name: 'Alice' } },
        { userId: 'user-2', user: { name: 'Bob'   } },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([
        makeReview({ id: 'r1', userId: 'user-1', status: 'COMPLETED', overallScore: 90 }),
        makeReview({ id: 'r2', userId: 'user-1', status: 'COMPLETED', overallScore: 80 }),
        makeReview({ id: 'r3', userId: 'user-2', status: 'FAILED',    overallScore: null }),
      ]);
      mockPrisma.issue.findMany.mockResolvedValue([
        makeIssue({ category: 'SECURITY', severity: 'HIGH' }),
      ]);

      const stats = await service.getTeamStats('user-1', AnalyticsRange.MONTH);

      expect(stats.teamId).toBe('team-1');
      expect(stats.memberCount).toBe(2);
      expect(stats.totalReviews).toBe(3);
      expect(stats.completedReviews).toBe(2);
      expect(stats.averageScore).toBe(85); // (90 + 80) / 2
      expect(stats.issuesByCategory.SECURITY).toBe(1);
      expect(stats.issuesBySeverity.HIGH).toBe(1);

      // Top contributors — Alice has 2, Bob has 1
      expect(stats.topContributors[0]).toEqual(
        expect.objectContaining({ userId: 'user-1', name: 'Alice', reviewCount: 2 }),
      );
      expect(stats.topContributors[1]).toEqual(
        expect.objectContaining({ userId: 'user-2', name: 'Bob', reviewCount: 1 }),
      );
    });

    it('returns cached result on second call', async () => {
      const cached = {
        range: AnalyticsRange.MONTH,
        teamId: 'team-1',
        memberCount: 3,
        totalReviews: 10,
        completedReviews: 8,
        averageScore: 77,
        issuesByCategory: {
          SECURITY: 0, PERFORMANCE: 0, QUALITY: 0, STYLE: 0,
          DOCUMENTATION: 0, TESTING: 0, DEPENDENCIES: 0,
        },
        issuesBySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        topContributors: [],
      };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.getTeamStats('user-1', AnalyticsRange.MONTH);

      expect(result).toEqual(cached);
      expect(mockPrisma.teamMember.findFirst).not.toHaveBeenCalled();
    });
  });
});
