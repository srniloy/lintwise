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

const ADMIN_ID = 'e2e-admin';
const USER_ID = 'e2e-user';
const TARGET_ID = 'target-user';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  review: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  // Stubs for cross-module DI graph
  notification: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  webhook: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  webhookDelivery: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
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
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: TARGET_ID,
    name: 'Target User',
    email: 'target@test.com',
    role: 'USER',
    password: 'hashed',
    isVerified: true,
    verificationToken: null,
    verificationExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    avatarUrl: null,
    notificationPreferences: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;

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

    adminToken = await jwtService.signAsync({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });
    userToken = await jwtService.signAsync({ sub: USER_ID, email: 'user@test.com', role: 'USER' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /api/v1/admin/users ───────────────────────────────────────────────

  describe('GET /api/v1/admin/users', () => {
    it('returns 401 without a Bearer token', () => {
      return request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
    });

    it('returns 403 for non-ADMIN roles', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('returns 200 with paginated users for ADMIN', async () => {
      mockPrisma.user.findMany.mockResolvedValue([makeUser({ id: 'a' }), makeUser({ id: 'b' })]);
      mockPrisma.user.count.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.page).toBe(1);
    });

    it('passes role filter through to Prisma', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/api/v1/admin/users?role=PREMIUM')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'PREMIUM' } }),
      );
    });

    it('returns 400 for an invalid role value', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/users?role=NOT_A_ROLE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ── PUT /api/v1/admin/users/:id/role ──────────────────────────────────────

  describe('PUT /api/v1/admin/users/:id/role', () => {
    it('returns 200 and updates the role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'USER' }));
      mockPrisma.user.update.mockResolvedValue(makeUser({ role: 'PREMIUM' }));

      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'PREMIUM' })
        .expect(200);

      expect(res.body.data.role).toBe('PREMIUM');
    });

    it('returns 403 for non-ADMIN', () => {
      return request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'PREMIUM' })
        .expect(403);
    });

    it('returns 404 for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .put('/api/v1/admin/users/missing/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'PREMIUM' })
        .expect(404);
    });

    it('returns 400 when demoting the last admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      mockPrisma.user.count.mockResolvedValue(1);

      return request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'USER' })
        .expect(400);
    });

    it('returns 400 for an invalid role value', () => {
      return request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'NOPE' })
        .expect(400);
    });
  });

  // ── PUT /api/v1/admin/users/:id/suspend ───────────────────────────────────

  describe('PUT /api/v1/admin/users/:id/suspend', () => {
    it('returns 200 and marks the user suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.user.update.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve(makeUser({ lockedUntil: data.lockedUntil })),
      );

      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.isSuspended).toBe(true);
    });

    it('returns 403 for non-ADMIN', () => {
      return request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/suspend`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ── PUT /api/v1/admin/users/:id/unsuspend ─────────────────────────────────

  describe('PUT /api/v1/admin/users/:id/unsuspend', () => {
    it('returns 200 and clears the suspension', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ lockedUntil: new Date(Date.now() + 60_000) }));
      mockPrisma.user.update.mockResolvedValue(makeUser({ lockedUntil: null }));

      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/users/${TARGET_ID}/unsuspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.isSuspended).toBe(false);
    });
  });

  // ── DELETE /api/v1/admin/users/:id ────────────────────────────────────────

  describe('DELETE /api/v1/admin/users/:id', () => {
    it('returns 204 on successful delete', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'USER' }));
      mockPrisma.user.delete.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${TARGET_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('returns 403 for non-ADMIN', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${TARGET_ID}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('returns 404 for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete('/api/v1/admin/users/missing')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 400 when deleting the last admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      mockPrisma.user.count.mockResolvedValue(1);

      return request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${TARGET_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ── GET /api/v1/admin/stats ───────────────────────────────────────────────

  describe('GET /api/v1/admin/stats', () => {
    it('returns 200 with the full stats shape for ADMIN', async () => {
      mockPrisma.user.count.mockResolvedValue(50);
      mockPrisma.review.count
        .mockResolvedValueOnce(500) // totalReviews
        .mockResolvedValueOnce(8)   // reviewsToday
        .mockResolvedValueOnce(40); // reviews7d
      mockPrisma.review.findMany
        .mockResolvedValueOnce([{ userId: 'a' }, { userId: 'b' }]) // active 7d
        .mockResolvedValueOnce([{ userId: 'a' }])                  // active today
        .mockResolvedValueOnce([]);                                // 30-day timestamps
      mockPrisma.review.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { _all: 480 } },
        { status: 'FAILED', _count: { _all: 5 } },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.totalUsers).toBe(50);
      expect(res.body.data.totalReviews).toBe(500);
      expect(res.body.data.reviewsToday).toBe(8);
      expect(res.body.data.reviews7d).toBe(40);
      expect(res.body.data.activeUsers7d).toBe(2);
      expect(res.body.data.activeUsersToday).toBe(1);
      expect(res.body.data.reviewsByStatus.COMPLETED).toBe(480);
      expect(res.body.data.reviewsByStatus.PENDING).toBe(0);
      expect(res.body.data.dailyReviews).toHaveLength(30);
    });

    it('returns 403 for non-ADMIN', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ── GET /api/v1/admin/system/health ───────────────────────────────────────

  describe('GET /api/v1/admin/system/health', () => {
    it('returns 200 with service statuses for ADMIN', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.database.status).toBe('UP');
      expect(res.body.data.redis.status).toBe('UP');
      expect(res.body.data.gemini.status).toBe('UP');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });

    it('returns DOWN for the database when the ping query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('boom'));
      mockCache.ping.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.database.status).toBe('DOWN');
    });

    it('returns 403 for non-ADMIN', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ── GET /api/v1/admin/rate-limits ─────────────────────────────────────────

  describe('GET /api/v1/admin/rate-limits', () => {
    it('returns 200 with three configured tiers for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/rate-limits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.tiers).toHaveLength(3);
      expect(res.body.data.tiers.map((t: any) => t.tier)).toEqual(['USER', 'PREMIUM', 'ADMIN']);
      expect(res.body.data.topUsers).toEqual([]);
    });

    it('returns 403 for non-ADMIN', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/rate-limits')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
