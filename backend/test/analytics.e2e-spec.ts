import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/gemini/gemini.service';
import { CacheService } from '../src/cache/cache.service';

// ── Identities ───────────────────────────────────────────────────────────────

const USER_ID = 'e2e-user-analytics';
const PREMIUM_USER_ID = 'e2e-premium-user';
const ADMIN_USER_ID = 'e2e-admin-user';

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

const mockGemini = {
  analyzeCode: jest.fn(),
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userToken: string;
  let premiumToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService).useValue(mockPrisma)
      .overrideProvider(GeminiService).useValue(mockGemini)
      .overrideProvider(CacheService).useValue(mockCache)
      .compile();

    app = moduleFixture.createNestApplication();

    app.use(helmet());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    userToken = await jwtService.signAsync({
      sub: USER_ID,
      email: 'user@lintwise.test',
      role: 'USER',
    });
    premiumToken = await jwtService.signAsync({
      sub: PREMIUM_USER_ID,
      email: 'premium@lintwise.test',
      role: 'PREMIUM',
    });
    adminToken = await jwtService.signAsync({
      sub: ADMIN_USER_ID,
      email: 'admin@lintwise.test',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);

    // Default empty state — individual tests override as needed
    mockPrisma.review.count.mockResolvedValue(0);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.issue.findMany.mockResolvedValue([]);
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
  });

  // ── GET /api/v1/analytics/personal ────────────────────────────────────────

  describe('GET /api/v1/analytics/personal', () => {
    it('returns 401 when no Bearer token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/personal')
        .expect(401);
    });

    it('returns 200 with default 30d range and the stats envelope', async () => {
      mockPrisma.review.count
        .mockResolvedValueOnce(12) // totalReviews
        .mockResolvedValueOnce(3); // thisMonthReviews
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: 'r1',
          userId: USER_ID,
          language: 'typescript',
          status: 'COMPLETED',
          overallScore: 82,
          createdAt: new Date('2024-01-15T00:00:00Z'),
        },
      ]);
      mockPrisma.issue.findMany.mockResolvedValue([
        { category: 'SECURITY', severity: 'HIGH' },
        { category: 'STYLE', severity: 'LOW' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/personal')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        range: '30d',
        totalReviews: 12,
        thisMonthReviews: 3,
      });
      expect(res.body.data.issuesByCategory.SECURITY).toBe(1);
      expect(res.body.data.issuesBySeverity.HIGH).toBe(1);
      expect(res.body.data.scoreTrend).toHaveLength(1);
      expect(res.body.data.scoreTrend[0].score).toBe(82);
      expect(res.body.data.languages[0]).toEqual({
        language: 'typescript',
        count: 1,
      });
    });

    it('returns 200 with range=7d honoured', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/personal?range=7d')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.range).toBe('7d');
    });

    it('returns 400 for an invalid range value', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/personal?range=1y')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });

  // ── GET /api/v1/analytics/team ────────────────────────────────────────────

  describe('GET /api/v1/analytics/team', () => {
    it('returns 401 when no Bearer token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/team')
        .expect(401);
    });

    it('returns 403 for a USER-role token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/team')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('returns 200 for a PREMIUM-role token with team aggregates', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: 'team-1' });
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { userId: PREMIUM_USER_ID, user: { name: 'Premium User' } },
        { userId: 'teammate-1',    user: { name: 'Teammate'    } },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: 'r1',
          userId: PREMIUM_USER_ID,
          status: 'COMPLETED',
          overallScore: 90,
        },
        {
          id: 'r2',
          userId: 'teammate-1',
          status: 'COMPLETED',
          overallScore: 70,
        },
      ]);
      mockPrisma.issue.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/team?range=30d')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        teamId: 'team-1',
        memberCount: 2,
        totalReviews: 2,
        completedReviews: 2,
        averageScore: 80,
      });
      expect(res.body.data.topContributors).toHaveLength(2);
    });

    it('returns 200 for an ADMIN-role token', async () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: 'team-admin' });
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { userId: ADMIN_USER_ID, user: { name: 'Admin User' } },
      ]);

      await request(app.getHttpServer())
        .get('/api/v1/analytics/team')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('returns 404 for a PREMIUM user with no team membership', () => {
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/analytics/team')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(404);
    });
  });
});
