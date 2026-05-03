import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/gemini/gemini.service';
import { CacheService } from '../src/cache/cache.service';
import { MailService } from '../src/mail/mail.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
  review: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
  issue: { createMany: jest.fn(), findMany: jest.fn() },
  codeSnippet: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  snippetVersion: { create: jest.fn(), findMany: jest.fn() },
  collection: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  collectionItem: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  team: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  teamMember: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
  teamInvite: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  comment: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  notification: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  webhook: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  webhookDelivery: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const mockGemini = { analyzeCode: jest.fn() };
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(4),
};
const mockMail = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewCompleteEmail: jest.fn().mockResolvedValue(undefined),
  sendCriticalIssueEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ────────────────────────────────────────────────────────────────────

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(GeminiService)
      .useValue(mockGemini)
      .overrideProvider(CacheService)
      .useValue(mockCache)
      .overrideProvider(MailService)
      .useValue(mockMail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all services healthy
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockCache.ping.mockResolvedValue(4);
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 when all services are up', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('success');
          expect(res.body.data.status).toBe('ok');
          expect(res.body.data.checks.db.status).toBe('up');
          expect(res.body.data.checks.redis.status).toBe('up');
          expect(res.body.data.checks.geminiApi.status).toBe('up');
          expect(typeof res.body.data.uptime).toBe('number');
          expect(typeof res.body.data.timestamp).toBe('string');
        });
    });

    it('does not require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
    });

    it('returns 503 when DB is down', () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(503);
    });

    it('returns 503 when Redis is down', () => {
      mockCache.ping.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(503);
    });
  });
});
