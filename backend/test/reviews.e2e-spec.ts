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

// ── Factories ─────────────────────────────────────────────────────────────────

const USER_ID = 'e2e-user-1';
const OTHER_USER_ID = 'e2e-user-2';
const REVIEW_ID = 'e2e-review-1';

function makeReview(overrides: Partial<any> = {}): any {
  return {
    id: REVIEW_ID,
    userId: USER_ID,
    title: 'E2E test review',
    language: 'typescript',
    code: 'const x = 1;',
    status: 'PENDING',
    overallScore: null,
    summary: null,
    issues: [],
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
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
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
};

const mockGemini = {
  analyzeCode: jest.fn().mockResolvedValue({
    overallScore: 85,
    summary: 'Good code',
    issues: [],
  }),
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};

const mockMail = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let ownerToken: string;
  let otherToken: string;

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

    // Generate tokens for two different users
    ownerToken = await jwtService.signAsync({
      sub: USER_ID,
      email: 'owner@lintwise.test',
      role: 'USER',
    });

    otherToken = await jwtService.signAsync({
      sub: OTHER_USER_ID,
      email: 'other@lintwise.test',
      role: 'USER',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-apply default mock implementations after clearAllMocks()
    mockPrisma.issue.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
    mockGemini.analyzeCode.mockResolvedValue({
      overallScore: 85,
      summary: 'Good code',
      issues: [],
    });
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.del.mockResolvedValue(undefined);
  });

  // ── POST /api/v1/reviews ─────────────────────────────────────────────────

  describe('POST /api/v1/reviews', () => {
    it('returns 401 when no Bearer token is provided', () => {
      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .send({ language: 'typescript', code: 'const x = 1;' })
        .expect(401);
    });

    it('returns 201 with the review in PENDING status', async () => {
      const created = makeReview();
      mockPrisma.review.create.mockResolvedValue(created);

      // processReview runs in background — mock its DB calls so it succeeds silently
      mockPrisma.review.update
        .mockResolvedValueOnce({ ...created, status: 'PROCESSING' })
        .mockResolvedValueOnce({ ...created, status: 'COMPLETED', overallScore: 85 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ language: 'typescript', code: 'const x = 1;' })
        .expect(201);

      // ResponseInterceptor wraps: { status: 'success', data: <review> }
      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        id: REVIEW_ID,
        status: 'PENDING',
        language: 'typescript',
      });
      expect(mockPrisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            status: 'PENDING',
          }),
        }),
      );
    });

    it('returns 400 when code exceeds 50,000 characters', () => {
      const longCode = 'x'.repeat(50_001);

      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ language: 'typescript', code: longCode })
        .expect(400);
    });

    it('returns 400 when code is shorter than 10 characters', () => {
      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ language: 'typescript', code: 'x' })
        .expect(400);
    });

    it('returns 400 when language is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ code: 'const x = 1;' })
        .expect(400);
    });
  });

  // ── GET /api/v1/reviews ───────────────────────────────────────────────────

  describe('GET /api/v1/reviews', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reviews')
        .expect(401);
    });

    it('returns 200 with paginated review list', async () => {
      const reviews = [makeReview({ status: 'COMPLETED', overallScore: 85 })];
      mockPrisma.review.findMany.mockResolvedValue(reviews);
      mockPrisma.review.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/reviews')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.reviews).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.page).toBe(1);
    });

    it('returns 200 with filtered results when status=COMPLETED', async () => {
      const completed = makeReview({ status: 'COMPLETED', overallScore: 85 });
      mockPrisma.review.findMany.mockResolvedValue([completed]);
      mockPrisma.review.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/reviews?status=COMPLETED')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.reviews[0].status).toBe('COMPLETED');
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('returns 400 for an invalid status filter value', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reviews?status=INVALID')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });
  });

  // ── GET /api/v1/reviews/:id/status ───────────────────────────────────────

  describe('GET /api/v1/reviews/:id/status', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}/status`)
        .expect(401);
    });

    it('returns 200 with status fields for the owner', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      mockPrisma.review.findUnique.mockResolvedValue({
        id: REVIEW_ID,
        userId: USER_ID,
        status: 'PROCESSING',
        createdAt: now,
        updatedAt: now,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toMatchObject({
        id: REVIEW_ID,
        status: 'PROCESSING',
      });
    });

    it('returns 403 when a different user requests the status', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        id: REVIEW_ID,
        userId: USER_ID,       // owned by USER_ID
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}/status`)
        .set('Authorization', `Bearer ${otherToken}`) // different user
        .expect(403);
    });

    it('returns 404 when the review does not exist', () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/reviews/nonexistent-id/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // ── GET /api/v1/reviews/:id ───────────────────────────────────────────────

  describe('GET /api/v1/reviews/:id', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}`)
        .expect(401);
    });

    it('returns 200 with the review and its issues for the owner', async () => {
      const review = makeReview({
        status: 'COMPLETED',
        overallScore: 85,
        summary: 'Looks good.',
        issues: [
          {
            id: 'issue-1',
            reviewId: REVIEW_ID,
            category: 'QUALITY',
            severity: 'LOW',
            title: 'Minor style issue',
            description: 'Consider renaming',
            suggestion: null,
            lineStart: 1,
            lineEnd: 1,
            fileName: 'index.ts',
            createdAt: new Date(),
          },
        ],
      });
      mockPrisma.review.findUnique.mockResolvedValue(review);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: REVIEW_ID,
        status: 'COMPLETED',
        overallScore: 85,
      });
      expect(res.body.data.issues).toHaveLength(1);
    });

    it('returns 200 from cache on second request', async () => {
      const cachedReview = makeReview({ status: 'COMPLETED', issues: [] });
      mockCache.get.mockResolvedValue(cachedReview);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(REVIEW_ID);
      expect(mockPrisma.review.findUnique).not.toHaveBeenCalled();
    });

    it('returns 403 for a different user', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(makeReview({ issues: [] }));

      return request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('returns 404 when the review does not exist', () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/reviews/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // ── DELETE /api/v1/reviews/:id ────────────────────────────────────────────

  describe('DELETE /api/v1/reviews/:id', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/reviews/${REVIEW_ID}`)
        .expect(401);
    });

    it('returns 204 and deletes the review for the owner', async () => {
      const review = makeReview();
      mockPrisma.review.findUnique.mockResolvedValue(review);
      mockPrisma.review.delete.mockResolvedValue(review);

      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${REVIEW_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      expect(mockPrisma.review.delete).toHaveBeenCalledWith({
        where: { id: REVIEW_ID },
      });
      expect(mockCache.del).toHaveBeenCalledWith(`review:result:${REVIEW_ID}`);
    });

    it('returns 403 when a different user tries to delete', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(makeReview({ userId: USER_ID }));

      return request(app.getHttpServer())
        .delete(`/api/v1/reviews/${REVIEW_ID}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('returns 404 when the review does not exist', () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete(`/api/v1/reviews/nonexistent-id`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
