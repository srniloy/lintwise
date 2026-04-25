import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

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
};

const mockMail = {
  sendReviewCompleteEmail: jest.fn().mockResolvedValue(undefined),
  sendCriticalIssueEmail: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    if (key === 'jwt.secret') return 'test-secret';
    return def;
  }),
};

// ── Factories ─────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<any> = {}): any {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'REVIEW_COMPLETED',
    title: 'Review Complete',
    message: 'Your review is ready.',
    data: { resourceId: 'review-1', resourceType: 'REVIEW' },
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('inserts a notification row and returns the mapped response', async () => {
      const n = makeNotification();
      mockPrisma.notification.create.mockResolvedValue(n);

      const result = await service.create('user-1', 'REVIEW_COMPLETED', 'Review Complete', 'Ready.', {
        resourceId: 'review-1',
        resourceType: 'REVIEW',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', type: 'REVIEW_COMPLETED', isRead: false }),
      });
      expect(result.id).toBe('notif-1');
      expect(result.resourceId).toBe('review-1');
      expect(result.resourceType).toBe('REVIEW');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns notifications with correct unreadCount', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        makeNotification({ id: 'n1', isRead: false }),
        makeNotification({ id: 'n2', isRead: true }),
        makeNotification({ id: 'n3', isRead: false }),
      ]);

      const { notifications, unreadCount } = await service.findAll('user-1');

      expect(notifications).toHaveLength(3);
      expect(unreadCount).toBe(2);
    });

    it('extracts resourceId and resourceType from data field', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        makeNotification({ data: { resourceId: 'rev-42', resourceType: 'REVIEW' } }),
      ]);

      const { notifications } = await service.findAll('user-1');

      expect(notifications[0].resourceId).toBe('rev-42');
      expect(notifications[0].resourceType).toBe('REVIEW');
    });

    it('handles notifications without data gracefully', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        makeNotification({ data: null }),
      ]);

      const { notifications } = await service.findAll('user-1');

      expect(notifications[0].resourceId).toBeUndefined();
    });
  });

  // ── markAsRead ────────────────────────────────────────────────────────────

  describe('markAsRead()', () => {
    it('sets isRead = true for the owner', async () => {
      const n = makeNotification({ isRead: false });
      mockPrisma.notification.findUnique.mockResolvedValue(n);
      mockPrisma.notification.update.mockResolvedValue({ ...n, isRead: true });

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
      expect(result.isRead).toBe(true);
    });

    it('throws NotFoundException for unknown notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when userId does not match', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification({ userId: 'other-user' }));

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── markAllAsRead ─────────────────────────────────────────────────────────

  describe('markAllAsRead()', () => {
    it('bulk-updates all unread notifications for the user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllAsRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
      expect(result.count).toBe(4);
    });
  });

  // ── getPreferences ────────────────────────────────────────────────────────

  describe('getPreferences()', () => {
    it('returns default prefs when notificationPreferences is null', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPreferences: null });

      const prefs = await service.getPreferences('user-1');

      expect(prefs).toEqual({ review_complete: true, critical_issues: true, team_mentions: true });
    });

    it('merges stored prefs over defaults', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        notificationPreferences: { review_complete: false },
      });

      const prefs = await service.getPreferences('user-1');

      expect(prefs.review_complete).toBe(false);
      expect(prefs.critical_issues).toBe(true);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getPreferences('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updatePreferences ─────────────────────────────────────────────────────

  describe('updatePreferences()', () => {
    it('persists merged preferences and returns the result', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPreferences: null });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.updatePreferences('user-1', { review_complete: false });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          notificationPreferences: expect.objectContaining({ review_complete: false }),
        },
      });
      expect(result.review_complete).toBe(false);
      expect(result.critical_issues).toBe(true);
    });
  });

  // ── unsubscribeByToken ────────────────────────────────────────────────────

  describe('unsubscribeByToken()', () => {
    it('disables all email prefs for a valid token', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      const token = service.generateUnsubscribeToken('user-abc');
      await service.unsubscribeByToken(token);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-abc' },
        data: {
          notificationPreferences: {
            review_complete: false,
            critical_issues: false,
            team_mentions: false,
          },
        },
      });
    });

    it('throws BadRequestException for a tampered token', async () => {
      await expect(service.unsubscribeByToken('invalid.token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── sendEmailIfEnabled ────────────────────────────────────────────────────

  describe('sendEmailIfEnabled()', () => {
    it('calls the send callback when the preference is enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.com',
        name: 'Test User',
        notificationPreferences: { review_complete: true },
      });

      const send = jest.fn().mockResolvedValue(undefined);
      await service.sendEmailIfEnabled('user-1', 'review_complete', send);

      expect(send).toHaveBeenCalledWith('user@test.com', 'Test User', expect.any(String));
    });

    it('does NOT call the send callback when the preference is disabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        email: 'user@test.com',
        name: 'Test User',
        notificationPreferences: { review_complete: false },
      });

      const send = jest.fn();
      await service.sendEmailIfEnabled('user-1', 'review_complete', send);

      expect(send).not.toHaveBeenCalled();
    });

    it('does NOT send if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const send = jest.fn();
      await service.sendEmailIfEnabled('bad-id', 'review_complete', send);

      expect(send).not.toHaveBeenCalled();
    });
  });
});
