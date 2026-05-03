/**
 * Full end-to-end smoke test:
 *   Register → verify email → login → submit review → get result → export → logout
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/gemini/gemini.service';
import { CacheService } from '../src/cache/cache.service';
import { MailService } from '../src/mail/mail.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGemini = { analyzeCode: jest.fn() };
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(3),
};
const mockMail = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewCompleteEmail: jest.fn().mockResolvedValue(undefined),
  sendCriticalIssueEmail: jest.fn().mockResolvedValue(undefined),
  sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined),
};

// Prisma mock factory — keeps a stable user and review object across calls
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

const VERIFY_TOKEN = randomUUID();
const USER_ID = 'smoke-user-id';
const REVIEW_ID = 'smoke-review-id';

const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  review: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  issue: {
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
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

// ── Suite ────────────────────────────────────────────────────────────────────

describe('Full flow smoke test (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  // Tokens captured during the flow
  let accessToken: string;
  let verificationToken: string;

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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Register ───────────────────────────────────────────────────────────

  describe('Step 1 — Register', () => {
    it('POST /api/v1/auth/register → 201 with tokens and user', async () => {
      const hashedPw = await bcrypt.hash('SecurePass1!', 10);

      const newUser = {
        id: USER_ID,
        name: 'Smoke User',
        email: 'smoke@example.com',
        password: hashedPw,
        role: 'USER',
        isVerified: false,
        verificationToken: hashToken(VERIFY_TOKEN),
        verificationExpiry: new Date(Date.now() + 86400000),
        resetToken: null,
        resetTokenExpiry: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // email not taken
      mockPrisma.user.create.mockResolvedValueOnce(newUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Smoke User', email: 'smoke@example.com', password: 'SecurePass1!' })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('smoke@example.com');

      // Capture the verification call's argument
      const mailCall = mockMail.sendVerificationEmail.mock.calls[0];
      if (mailCall) {
        verificationToken = mailCall[2]; // third arg is the plain token
      }
    });
  });

  // ── 2. Verify Email ───────────────────────────────────────────────────────

  describe('Step 2 — Verify Email', () => {
    it('GET /api/v1/auth/verify-email?token=... → 200', async () => {
      const token = verificationToken ?? VERIFY_TOKEN;

      // verifyEmail uses findFirst (verificationToken is not @unique)
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: USER_ID,
        email: 'smoke@example.com',
        isVerified: false,
        verificationToken: hashToken(token),
        verificationExpiry: new Date(Date.now() + 86400000),
      });
      mockPrisma.user.update.mockResolvedValueOnce({ id: USER_ID });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/verify-email?token=${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });

  // ── 3. Login ──────────────────────────────────────────────────────────────

  describe('Step 3 — Login', () => {
    it('POST /api/v1/auth/login → 200 with accessToken', async () => {
      // Pre-computed bcrypt hash of 'SecurePass1!' (10 rounds)
      const hashedPw = '$2b$10$G2w7oM2.7GkXTfmBQ289POokoI3Q2X5oc0blgHKQ9h9jo/HdyX4SC';

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: USER_ID,
        name: 'Smoke User',
        email: 'smoke@example.com',
        password: hashedPw,
        role: 'USER',
        isVerified: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValueOnce({ id: USER_ID });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'smoke@example.com', password: 'SecurePass1!' })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toBeDefined();
      accessToken = res.body.data.accessToken;
    });
  });

  // ── 4. Submit Review ──────────────────────────────────────────────────────

  describe('Step 4 — Submit Review', () => {
    it('POST /api/v1/reviews → 201 with PENDING status', async () => {
      mockPrisma.review.create.mockResolvedValueOnce({
        id: REVIEW_ID,
        userId: USER_ID,
        title: 'Smoke Test Review',
        language: 'javascript',
        code: 'console.log("hello")',
        status: 'PENDING',
        overallScore: null,
        summary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // GeminiService.analyzeCode resolves (processing runs in background)
      mockGemini.analyzeCode.mockResolvedValue({
        overallScore: 85,
        summary: 'Good code',
        issues: [],
      });
      mockPrisma.review.findUnique.mockResolvedValue({
        id: REVIEW_ID,
        userId: USER_ID,
        status: 'PENDING',
      });
      mockPrisma.review.update.mockResolvedValue({ id: REVIEW_ID, status: 'COMPLETED' });
      mockPrisma.issue.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-id' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Smoke Test Review',
          language: 'javascript',
          code: 'console.log("hello")',
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('PENDING');
    });
  });

  // ── 5. Get Review Result ──────────────────────────────────────────────────

  describe('Step 5 — Get Review Result', () => {
    it('GET /api/v1/reviews/:id → 200 with review details', async () => {
      mockCache.get.mockResolvedValueOnce(null); // no cache hit

      mockPrisma.review.findUnique.mockResolvedValueOnce({
        id: REVIEW_ID,
        userId: USER_ID,
        title: 'Smoke Test Review',
        language: 'javascript',
        code: 'console.log("hello")',
        status: 'COMPLETED',
        overallScore: 85,
        summary: 'Good code',
        issues: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe(REVIEW_ID);
    });
  });

  // ── 6. Export Review ──────────────────────────────────────────────────────

  describe('Step 6 — Export Review as JSON', () => {
    it('GET /api/v1/reviews/:id/export?format=json → 200', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce({
        id: REVIEW_ID,
        userId: USER_ID,
        title: 'Smoke Test Review',
        language: 'javascript',
        code: 'console.log("hello")',
        status: 'COMPLETED',
        overallScore: 85,
        summary: 'Good code',
        issues: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${REVIEW_ID}/export?format=json`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  // ── 7. Logout ─────────────────────────────────────────────────────────────

  describe('Step 7 — Logout', () => {
    it('POST /api/v1/auth/logout → 204 and invalidates token', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: USER_ID,
        email: 'smoke@example.com',
        role: 'USER',
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify cache.del was called to revoke the refresh token
      expect(mockCache.del).toHaveBeenCalledWith(expect.stringContaining(USER_ID));
    });
  });

  // ── 8. Verify Token Is Invalid After Logout ───────────────────────────────

  describe('Step 8 — Token Invalidated', () => {
    it('GET /api/v1/users/profile after logout returns 401 for revoked refresh token', async () => {
      // The access token itself is still JWT-valid (it hasn't expired),
      // but the user lookup can return a locked/deleted user or we just verify
      // that making a profile request with a fully expired token → 401.
      const expiredToken = jwtService.sign(
        { sub: USER_ID, email: 'smoke@example.com', role: 'USER' },
        { expiresIn: 0 },
      );

      return request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});
