import * as crypto from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { NotificationPreferencesDto } from './dto/notification-preferences.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationPrefsRecord {
  review_complete: boolean;
  critical_issues: boolean;
  team_mentions: boolean;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  resourceId?: string;
  resourceType?: string;
  createdAt: Date;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPrefsRecord = {
  review_complete: true,
  critical_issues: true,
  team_mentions: true,
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsService {
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('jwt.secret', 'secret');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapNotification(n: {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    data: unknown;
    createdAt: Date;
  }): NotificationResponse {
    const data = n.data as { resourceId?: string; resourceType?: string } | null;
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
      ...(data?.resourceId && { resourceId: data.resourceId }),
      ...(data?.resourceType && { resourceType: data.resourceType }),
    };
  }

  // ── Internal (called by other services) ──────────────────────────────────

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, message, data: (data ?? undefined) as Prisma.InputJsonValue | undefined, isRead: false },
    });
    return this.mapNotification(notification);
  }

  // ── Controller-facing ─────────────────────────────────────────────────────

  async findAll(
    userId: string,
  ): Promise<{ notifications: NotificationResponse[]; unreadCount: number }> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const notifications = rows.map((n) => this.mapNotification(n));
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return { notifications, unreadCount };
  }

  async markAsRead(id: string, userId: string): Promise<NotificationResponse> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return this.mapNotification(updated);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  // ── Preferences ───────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPrefsRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const stored = user.notificationPreferences as Partial<NotificationPrefsRecord> | null;
    return { ...DEFAULT_PREFS, ...stored };
  }

  async updatePreferences(
    userId: string,
    dto: NotificationPreferencesDto,
  ): Promise<NotificationPrefsRecord> {
    const current = await this.getPreferences(userId);
    // Only merge fields explicitly provided in the request (skip undefined optional fields)
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as Partial<NotificationPrefsRecord>;
    const merged: NotificationPrefsRecord = { ...current, ...patch };

    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: merged as unknown as Prisma.InputJsonValue },
    });

    return merged;
  }

  // ── Unsubscribe (stateless HMAC token) ────────────────────────────────────

  generateUnsubscribeToken(userId: string): string {
    const sig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${userId}:unsubscribe`)
      .digest('hex');
    return `${Buffer.from(userId).toString('base64url')}.${sig}`;
  }

  private parseUnsubscribeToken(token: string): string | null {
    const dot = token.indexOf('.');
    if (dot === -1) return null;
    const encodedId = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    let userId: string;
    try {
      userId = Buffer.from(encodedId, 'base64url').toString('utf-8');
    } catch {
      return null;
    }

    const expected = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${userId}:unsubscribe`)
      .digest('hex');

    return sig === expected ? userId : null;
  }

  async unsubscribeByToken(token: string): Promise<{ message: string }> {
    const userId = this.parseUnsubscribeToken(token);
    if (!userId) throw new BadRequestException('Invalid unsubscribe token');

    const disabledAll: NotificationPrefsRecord = {
      review_complete: false,
      critical_issues: false,
      team_mentions: false,
    };

    await this.prisma.user
      .update({ where: { id: userId }, data: { notificationPreferences: disabledAll as unknown as Prisma.InputJsonValue } })
      .catch(() => {
        throw new NotFoundException('User not found');
      });

    return { message: 'Email notifications disabled successfully' };
  }

  // ── Email notification helpers (used internally) ──────────────────────────

  async sendEmailIfEnabled(
    userId: string,
    prefKey: keyof NotificationPrefsRecord,
    send: (email: string, name: string, unsubToken: string) => Promise<void>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, notificationPreferences: true },
    });
    if (!user) return;

    const prefs: NotificationPrefsRecord = {
      ...DEFAULT_PREFS,
      ...(user.notificationPreferences as Partial<NotificationPrefsRecord> | null),
    };
    if (!prefs[prefKey]) return;

    const unsubToken = this.generateUnsubscribeToken(userId);
    await send(user.email, user.name, unsubToken);
  }
}
