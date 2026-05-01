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
import { MailService } from '../src/mail/mail.service';

// ── Identities ───────────────────────────────────────────────────────────────

const USER_ID = 'e2e-hook-user';
const PREMIUM_ID = 'e2e-hook-premium';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  webhook: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  webhookDelivery: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  // Mocks needed by other modules' DI graph
  notification: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  review: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  issue: { findMany: jest.fn() },
  teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
};

const mockGemini = { analyzeCode: jest.fn() };
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};
const mockMail = {
  sendReviewCompleteEmail: jest.fn().mockResolvedValue(undefined),
  sendCriticalIssueEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWebhook(overrides: Partial<any> = {}): any {
  return {
    id: 'hook-e2e-1',
    userId: PREMIUM_ID,
    url: 'https://example.com/hook',
    events: ['REVIEW_COMPLETED'],
    secret: 'whsec_e2e-secret',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('Webhooks (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userToken: string;
  let premiumToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService).useValue(mockPrisma)
      .overrideProvider(GeminiService).useValue(mockGemini)
      .overrideProvider(CacheService).useValue(mockCache)
      .overrideProvider(MailService).useValue(mockMail)
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
      email: 'user@test.com',
      role: 'USER',
    });

    premiumToken = await jwtService.signAsync({
      sub: PREMIUM_ID,
      email: 'premium@test.com',
      role: 'PREMIUM',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/v1/webhooks ────────────────────────────────────────────────

  describe('POST /api/v1/webhooks', () => {
    it('returns 401 when no Bearer token is provided', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .send({ url: 'https://example.com/hook', events: ['REVIEW_COMPLETED'] })
        .expect(401);
    });

    it('returns 403 for USER role (PREMIUM/ADMIN only)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ url: 'https://example.com/hook', events: ['REVIEW_COMPLETED'] })
        .expect(403);
    });

    it('returns 201 with the new webhook (including secret) for PREMIUM users', async () => {
      mockPrisma.webhook.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve(makeWebhook({ ...data })),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ url: 'https://example.com/hook', events: ['REVIEW_COMPLETED'] })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.url).toBe('https://example.com/hook');
      expect(res.body.data.events).toEqual(['REVIEW_COMPLETED']);
      expect(res.body.data.secret).toMatch(/^whsec_/);
      expect(res.body.data.isActive).toBe(true);
    });

    it('returns 400 for an invalid URL', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ url: 'not-a-url', events: ['REVIEW_COMPLETED'] })
        .expect(400);
    });

    it('returns 400 when the events list is empty', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ url: 'https://example.com/hook', events: [] })
        .expect(400);
    });

    it('returns 400 for an unknown event type', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ url: 'https://example.com/hook', events: ['NOT_A_REAL_EVENT'] })
        .expect(400);
    });
  });

  // ── GET /api/v1/webhooks ─────────────────────────────────────────────────

  describe('GET /api/v1/webhooks', () => {
    it('returns 403 for USER role', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('returns 200 with the user\'s webhooks for PREMIUM', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([
        makeWebhook({ id: 'h1' }),
        makeWebhook({ id: 'h2', url: 'https://b.test' }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: PREMIUM_ID } }),
      );
    });
  });

  // ── PUT /api/v1/webhooks/:id ─────────────────────────────────────────────

  describe('PUT /api/v1/webhooks/:id', () => {
    it('returns 200 when updating the user\'s own webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhook.update.mockResolvedValue(makeWebhook({ isActive: false }));

      const res = await request(app.getHttpServer())
        .put('/api/v1/webhooks/hook-e2e-1')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.data.isActive).toBe(false);
    });

    it('returns 403 when updating someone else\'s webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(
        makeWebhook({ userId: 'someone-else' }),
      );

      return request(app.getHttpServer())
        .put('/api/v1/webhooks/hook-e2e-1')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ isActive: false })
        .expect(403);
    });

    it('returns 404 for an unknown webhook id', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .put('/api/v1/webhooks/missing')
        .set('Authorization', `Bearer ${premiumToken}`)
        .send({ isActive: false })
        .expect(404);
    });

    it('returns 403 for USER role', () => {
      return request(app.getHttpServer())
        .put('/api/v1/webhooks/anything')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isActive: false })
        .expect(403);
    });
  });

  // ── DELETE /api/v1/webhooks/:id ──────────────────────────────────────────

  describe('DELETE /api/v1/webhooks/:id', () => {
    it('returns 204 on successful delete', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhook.delete.mockResolvedValue(makeWebhook());

      return request(app.getHttpServer())
        .delete('/api/v1/webhooks/hook-e2e-1')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(204);
    });

    it('returns 403 when deleting someone else\'s webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(
        makeWebhook({ userId: 'someone-else' }),
      );

      return request(app.getHttpServer())
        .delete('/api/v1/webhooks/hook-e2e-1')
        .set('Authorization', `Bearer ${premiumToken}`)
        .expect(403);
    });

    it('returns 403 for USER role', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/webhooks/hook-e2e-1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
