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
import { NotificationsService } from '../src/notifications/notifications.service';

// ── Identities ────────────────────────────────────────────────────────────────

const USER_ID = 'e2e-notif-user';
const OTHER_USER_ID = 'e2e-notif-other';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  review: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  issue: { findMany: jest.fn() },
  teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
};

const mockGemini = { analyzeCode: jest.fn() };
const mockMail = {
  sendReviewCompleteEmail: jest.fn().mockResolvedValue(undefined),
  sendCriticalIssueEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewFailedEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotif(overrides: Partial<any> = {}): any {
  return {
    id: 'notif-e2e-1',
    userId: USER_ID,
    type: 'REVIEW_COMPLETED',
    title: 'Review Complete',
    message: 'Your review is ready.',
    data: { resourceId: 'review-1', resourceType: 'REVIEW' },
    isRead: false,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let notificationsService: NotificationsService;
  let userToken: string;
  let otherToken: string;

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
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

    userToken = await jwtService.signAsync({ sub: USER_ID, email: 'user@test.com', role: 'USER' });
    otherToken = await jwtService.signAsync({ sub: OTHER_USER_ID, email: 'other@test.com', role: 'USER' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  // ── GET /api/v1/notifications ─────────────────────────────────────────────

  describe('GET /api/v1/notifications', () => {
    it('returns 401 when no token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications')
        .expect(401);
    });

    it('returns 200 with notifications list and unreadCount', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        makeNotif({ id: 'n1', isRead: false }),
        makeNotif({ id: 'n2', isRead: true }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.notifications).toHaveLength(2);
      expect(res.body.data.unreadCount).toBe(1);
    });

    it('flattens resourceId and resourceType from the data field', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        makeNotif({ data: { resourceId: 'rev-999', resourceType: 'REVIEW' } }),
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.notifications[0].resourceId).toBe('rev-999');
      expect(res.body.data.notifications[0].resourceType).toBe('REVIEW');
    });
  });

  // ── PATCH /api/v1/notifications/:id/read ─────────────────────────────────

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/notifications/notif-1/read')
        .expect(401);
    });

    it('returns 200 and marks notification as read for the owner', async () => {
      const n = makeNotif();
      mockPrisma.notification.findUnique.mockResolvedValue(n);
      mockPrisma.notification.update.mockResolvedValue({ ...n, isRead: true });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/notif-e2e-1/read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.isRead).toBe(true);
    });

    it('returns 403 when notification belongs to a different user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(
        makeNotif({ userId: USER_ID }),
      );

      return request(app.getHttpServer())
        .patch('/api/v1/notifications/notif-e2e-1/read')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('returns 404 for an unknown notification ID', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch('/api/v1/notifications/does-not-exist/read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  // ── PATCH /api/v1/notifications/read-all ─────────────────────────────────

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .expect(401);
    });

    it('returns 200 with count of updated notifications', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.count).toBe(5);
    });
  });

  // ── GET /api/v1/notifications/preferences ────────────────────────────────

  describe('GET /api/v1/notifications/preferences', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .expect(401);
    });

    it('returns 200 with default preferences when none are stored', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPreferences: null });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toEqual({
        review_complete: true,
        critical_issues: true,
        team_mentions: true,
      });
    });
  });

  // ── PUT /api/v1/notifications/preferences ────────────────────────────────

  describe('PUT /api/v1/notifications/preferences', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .send({ review_complete: false })
        .expect(401);
    });

    it('returns 200 with merged preferences', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPreferences: null });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ review_complete: false })
        .expect(200);

      expect(res.body.data.review_complete).toBe(false);
      expect(res.body.data.critical_issues).toBe(true);
    });

    it('returns 400 for invalid boolean value', () => {
      return request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ review_complete: 'yes' })
        .expect(400);
    });
  });

  // ── GET /api/v1/notifications/unsubscribe ────────────────────────────────

  describe('GET /api/v1/notifications/unsubscribe', () => {
    it('returns 200 for a valid unsubscribe token (no auth required)', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      const token = notificationsService.generateUnsubscribeToken('some-user-id');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/notifications/unsubscribe?token=${token}`)
        .expect(200);

      expect(res.body.data.message).toMatch(/disabled/i);
    });

    it('returns 400 for an invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications/unsubscribe?token=bad.token')
        .expect(400);
    });

    it('does not require a Bearer token (public endpoint)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications/unsubscribe?token=bad.token')
        .expect(400); // 400, not 401 — public route reached the handler
    });
  });
});
