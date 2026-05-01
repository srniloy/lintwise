import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { CacheService } from '../cache/cache.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import type { AIReviewResult } from '../gemini/gemini.types';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeReview(overrides: Partial<any> = {}): any {
  return {
    id: 'review-1',
    userId: 'user-1',
    title: 'Test review',
    language: 'typescript',
    code: 'const x = 1;',
    status: 'PENDING',
    overallScore: null,
    summary: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    issues: [],
    ...overrides,
  };
}

function makeIssue(overrides: Partial<any> = {}): any {
  return {
    id: 'issue-1',
    reviewId: 'review-1',
    category: 'QUALITY',
    severity: 'MEDIUM',
    title: 'Magic number',
    description: 'Avoid magic numbers',
    suggestion: 'Extract to a named constant',
    lineStart: 1,
    lineEnd: 1,
    fileName: 'index.ts',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeAIResult(overrides: Partial<AIReviewResult> = {}): AIReviewResult {
  return {
    overallScore: 85,
    summary: 'Good code overall.',
    issues: [
      {
        category: 'QUALITY',
        severity: 'MEDIUM',
        title: 'Magic number',
        description: 'Avoid magic numbers in code.',
        suggestion: 'Extract to a named constant.',
        lineStart: 1,
        lineEnd: 1,
        fileName: 'index.ts',
      },
    ],
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  review: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  issue: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
};

const mockGemini = {
  analyzeCode: jest.fn(),
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};

const mockAnalytics = {
  bustUserCache: jest.fn().mockResolvedValue(undefined),
};

const mockNotifications = {
  create: jest.fn().mockResolvedValue(undefined),
  sendEmailIfEnabled: jest.fn().mockResolvedValue(undefined),
};

const mockMail = {
  sendReviewCompleteEmail: jest.fn().mockResolvedValue(undefined),
  sendCriticalIssueEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewFailedEmail: jest.fn().mockResolvedValue(undefined),
};

const mockWebhooks = {
  dispatch: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Re-apply defaults after clearAllMocks()
    mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.del.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GeminiService, useValue: mockGemini },
        { provide: CacheService, useValue: mockCache },
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: MailService, useValue: mockMail },
        { provide: WebhooksService, useValue: mockWebhooks },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a review with PENDING status and triggers background processing', async () => {
      const dto = { language: 'typescript', code: 'const x = 1;' };
      const created = makeReview({ status: 'PENDING' });

      mockPrisma.review.create.mockResolvedValue(created);

      // Prevent background processReview from running through real logic
      jest.spyOn(service, 'processReview').mockResolvedValue(undefined);

      const result = await service.create('user-1', dto as any);

      expect(result.status).toBe('PENDING');
      expect(result.userId).toBe('user-1');
      expect(mockPrisma.review.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          language: 'typescript',
          code: 'const x = 1;',
          status: 'PENDING',
        }),
      });
      // processReview is triggered (fire-and-forget)
      expect(service.processReview).toHaveBeenCalledWith(created.id);
    });

    it('throws BadRequestException when code exceeds 10,000 lines', async () => {
      const longCode = 'x\n'.repeat(10_001);
      const dto = { language: 'typescript', code: longCode };

      await expect(service.create('user-1', dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.review.create).not.toHaveBeenCalled();
    });

    it('returns the review immediately without waiting for processing', async () => {
      const dto = { language: 'python', code: 'print("hello")' };
      const created = makeReview({ language: 'python' });

      mockPrisma.review.create.mockResolvedValue(created);

      let processStarted = false;
      jest.spyOn(service, 'processReview').mockImplementation(async () => {
        processStarted = true;
      });

      const result = await service.create('user-1', dto as any);

      // Returns immediately — process may or may not have started yet
      expect(result).toEqual(created);
      // Give microtask queue a tick to confirm processReview was scheduled
      await Promise.resolve();
      expect(processStarted).toBe(true);
    });
  });

  // ── processReview() ───────────────────────────────────────────────────────

  describe('processReview()', () => {
    it('sets status to PROCESSING then COMPLETED on success', async () => {
      const review = makeReview({ status: 'PENDING' });
      const aiResult = makeAIResult({ issues: [] });

      // First update call → sets PROCESSING and returns the review
      mockPrisma.review.update
        .mockResolvedValueOnce({ ...review, status: 'PROCESSING' })
        // Inside $transaction: update to COMPLETED
        .mockResolvedValueOnce({ ...review, status: 'COMPLETED', overallScore: 85 });

      mockGemini.analyzeCode.mockResolvedValue(aiResult);
      mockPrisma.issue.createMany.mockResolvedValue({ count: 0 });

      await service.processReview('review-1');

      // First call: mark PROCESSING
      expect(mockPrisma.review.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'review-1' },
        data: { status: 'PROCESSING' },
      });

      // Gemini called with review data
      expect(mockGemini.analyzeCode).toHaveBeenCalledWith(
        review.code,
        review.language,
        review.title,
      );

      // Transaction executed
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('saves Issues from the Gemini response', async () => {
      const review = makeReview();
      const issue = makeIssue();
      const aiResult = makeAIResult({
        overallScore: 72,
        issues: [
          {
            category: 'SECURITY',
            severity: 'HIGH',
            title: 'SQL injection risk',
            description: 'Unsanitized input used in query',
            suggestion: 'Use parameterized queries',
            lineStart: 10,
            lineEnd: 12,
            fileName: 'db.ts',
          },
        ],
      });

      mockPrisma.review.update
        .mockResolvedValueOnce({ ...review, status: 'PROCESSING' })
        .mockResolvedValueOnce({ ...review, status: 'COMPLETED', overallScore: 72 });
      mockGemini.analyzeCode.mockResolvedValue(aiResult);
      mockPrisma.issue.createMany.mockResolvedValue({ count: 1 });

      await service.processReview('review-1');

      // issue.createMany called with mapped data
      expect(mockPrisma.issue.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            reviewId: 'review-1',
            category: 'SECURITY',
            severity: 'HIGH',
            title: 'SQL injection risk',
            lineStart: 10,
            lineEnd: 12,
            fileName: 'db.ts',
          }),
        ],
      });

      // review updated with score and summary
      expect(mockPrisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            overallScore: 72,
          }),
        }),
      );

      // Suppress unused var warning
      void issue;
    });

    it('sets status to FAILED and re-throws when Gemini throws', async () => {
      const review = makeReview();
      const geminiError = new Error('Gemini API error');

      mockPrisma.review.update
        .mockResolvedValueOnce({ ...review, status: 'PROCESSING' })  // PROCESSING
        .mockResolvedValueOnce({ ...review, status: 'FAILED' });      // FAILED

      mockGemini.analyzeCode.mockRejectedValue(geminiError);

      await expect(service.processReview('review-1')).rejects.toThrow(
        'Gemini API error',
      );

      // FAILED update must be called
      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: { status: 'FAILED' },
      });
    });

    it('still resolves (marks FAILED) even if the FAILED update itself throws', async () => {
      const review = makeReview();

      mockPrisma.review.update
        .mockResolvedValueOnce({ ...review, status: 'PROCESSING' })
        .mockRejectedValueOnce(new Error('DB connection lost')); // FAILED update fails

      mockGemini.analyzeCode.mockRejectedValue(new Error('Gemini timeout'));

      // Should reject with the original Gemini error, NOT the DB error
      await expect(service.processReview('review-1')).rejects.toThrow(
        'Gemini timeout',
      );
    });
  });

  // ── getStatus() ───────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns id, status, createdAt and updatedAt for the owner', async () => {
      const now = new Date();
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        userId: 'user-1',
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.getStatus('review-1', 'user-1');

      expect(result).toEqual({
        id: 'review-1',
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('bad-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a different user', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: 'review-1',
        userId: 'user-1',
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.getStatus('review-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns review with issues for the owner', async () => {
      const issue = makeIssue();
      const review = makeReview({ issues: [issue] });
      mockPrisma.review.findUnique.mockResolvedValue(review);

      const result = await service.findOne('review-1', 'user-1');

      expect(result.id).toBe('review-1');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe('QUALITY');
      expect(mockPrisma.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        include: { issues: true },
      });
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a different user', async () => {
      const review = makeReview({ issues: [] });
      mockPrisma.review.findUnique.mockResolvedValue(review);

      await expect(service.findOne('review-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── findAllByUser() ───────────────────────────────────────────────────────

  describe('findAllByUser()', () => {
    it('returns paginated reviews for the user', async () => {
      const reviews = [makeReview(), makeReview({ id: 'review-2' })];
      mockPrisma.review.findMany.mockResolvedValue(reviews);
      mockPrisma.review.count.mockResolvedValue(2);

      const result = await service.findAllByUser('user-1', { page: 1, limit: 10 });

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('filters by status when provided', async () => {
      mockPrisma.review.findMany.mockResolvedValue([makeReview({ status: 'COMPLETED' })]);
      mockPrisma.review.count.mockResolvedValue(1);

      await service.findAllByUser('user-1', { status: 'COMPLETED' as any });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', status: 'COMPLETED' }),
        }),
      );
    });

    it('filters by date range when startDate and endDate are provided', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(0);

      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await service.findAllByUser('user-1', { startDate, endDate });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        }),
      );
    });

    it('returns correct page offset for page 2', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      mockPrisma.review.count.mockResolvedValue(25);

      const result = await service.findAllByUser('user-1', { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── getFullResult() ───────────────────────────────────────────────────────

  describe('getFullResult()', () => {
    it('returns review with issues for the owner', async () => {
      const issue = makeIssue();
      const review = makeReview({ status: 'COMPLETED', issues: [issue] });
      mockPrisma.review.findUnique.mockResolvedValue(review);

      const result = await service.getFullResult('review-1', 'user-1');

      expect(result.id).toBe('review-1');
      expect(result.issues).toHaveLength(1);
      expect(mockPrisma.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        include: { issues: true },
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'review:result:review-1',
        review,
        expect.any(Number),
      );
    });

    it('returns cached result without hitting the database', async () => {
      const cachedReview = makeReview({ status: 'COMPLETED', issues: [] });
      mockCache.get.mockResolvedValue(cachedReview);

      const result = await service.getFullResult('review-1', 'user-1');

      expect(result).toEqual(cachedReview);
      expect(mockPrisma.review.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.getFullResult('bad-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a different user', async () => {
      const review = makeReview({ issues: [] });
      mockPrisma.review.findUnique.mockResolvedValue(review);

      await expect(service.getFullResult('review-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── delete() ──────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('deletes the review and invalidates cache for the owner', async () => {
      const review = makeReview();
      mockPrisma.review.findUnique.mockResolvedValue(review);
      mockPrisma.review.delete.mockResolvedValue(review);

      await service.delete('review-1', 'user-1');

      expect(mockPrisma.review.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
      expect(mockCache.del).toHaveBeenCalledWith('review:result:review-1');
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.review.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when user does not own the review', async () => {
      const review = makeReview({ userId: 'user-1' });
      mockPrisma.review.findUnique.mockResolvedValue(review);

      await expect(service.delete('review-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.review.delete).not.toHaveBeenCalled();
    });
  });
});
