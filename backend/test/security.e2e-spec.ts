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

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  review: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  issue: { createMany: jest.fn(), findMany: jest.fn() },
  codeSnippet: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  snippetVersion: { create: jest.fn(), findMany: jest.fn() },
  collection: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  collectionItem: { create: jest.fn(), delete: jest.fn() },
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

describe('Security (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

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
    app.use(
      helmet({
        frameguard: { action: 'deny' },
        noSniff: true,
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        xssFilter: true,
        referrerPolicy: { policy: 'same-origin' },
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
      }),
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockCache.ping.mockResolvedValue(4);
    mockCache.get.mockResolvedValue(null);
  });

  // ── Security Headers ──────────────────────────────────────────────────────

  describe('Security headers', () => {
    it('sets X-Frame-Options: DENY', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('sets X-Content-Type-Options: nosniff', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets Strict-Transport-Security header', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('sets Content-Security-Policy header', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1');
      expect(res.headers['content-security-policy']).toBeDefined();
    });
  });

  // ── Input Validation (before rate limit test to avoid throttle bleed) ──────

  describe('SQL injection attempt', () => {
    it('returns 400 for SQL injection in email field — not 500', () => {
      // ValidationPipe rejects the malformed email before it reaches Prisma
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: "'; DROP TABLE users; --", password: 'Test1234!' })
        .expect(400);
    });
  });

  // ── Rate Limiting ─────────────────────────────────────────────────────────

  describe('Rate limiting — auth routes', () => {
    it('returns 429 after exceeding login rate limit', async () => {
      // Simulate a user that doesn't exist (prisma returns null → 401 normally)
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const loginPayload = { email: 'ratelimit@test.com', password: 'WrongPass1!' };

      // NestJS throttler: 10 req per 15 min on auth routes; we send 11
      let lastResponse: request.Response | null = null;
      for (let i = 0; i < 11; i++) {
        lastResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(loginPayload);
      }
      // The 11th request exceeds the 10 req/15 min auth throttle → 429
      expect(lastResponse!.status).toBe(429);
    });
  });

  // ── Token Security ────────────────────────────────────────────────────────

  describe('Expired access token', () => {
    it('returns 401 for an expired JWT', async () => {
      // Sign with a very short expiry that has already passed
      const expiredToken = jwtService.sign(
        { sub: 'user-id', email: 'test@test.com', role: 'USER' },
        { expiresIn: 0 },
      );

      return request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Revoked refresh token', () => {
    it('returns 401 when reusing a revoked refresh token', async () => {
      // Cache returns null → token is revoked / not stored
      mockCache.get.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'revoked-refresh-token' })
        .expect(401);
    });
  });
});
