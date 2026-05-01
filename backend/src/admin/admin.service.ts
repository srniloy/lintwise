import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import type { ListUsersDto } from './dto/list-users.dto';

// ── Constants ────────────────────────────────────────────────────────────────

/** A "far future" lockout effectively suspends the account indefinitely. */
const SUSPEND_UNTIL = new Date('9999-12-31T23:59:59.999Z');

// ── Types ────────────────────────────────────────────────────────────────────

export type AdminUserView = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedUsers = {
  data: AdminUserView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PlatformStats = {
  totalUsers: number;
  activeUsersToday: number;
  activeUsers7d: number;
  totalReviews: number;
  reviewsToday: number;
  reviews7d: number;
  reviewsByStatus: {
    PENDING: number;
    PROCESSING: number;
    COMPLETED: number;
    FAILED: number;
  };
  dailyReviews: { date: string; count: number }[];
};

export type ServiceStatus = 'UP' | 'DOWN' | 'DEGRADED';

export type ServiceHealth = {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
};

export type SystemHealth = {
  database: ServiceHealth;
  redis: ServiceHealth;
  gemini: ServiceHealth;
  uptimeSeconds: number;
  checkedAt: string;
};

export type RateLimitTier = {
  tier: 'USER' | 'PREMIUM' | 'ADMIN';
  limit: number;
  windowSeconds: number;
  used: number;
  utilization: number;
};

export type RateLimitMonitor = {
  tiers: RateLimitTier[];
  topUsers: never[];
};

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toView(user: User): AdminUserView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isSuspended: !!(user.lockedUntil && user.lockedUntil > new Date()),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async findOrThrow(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getAllUsers(dto: ListUsersDto): Promise<PaginatedUsers> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (dto.role) where.role = dto.role;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.toView(u)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async updateUserRole(userId: string, role: Role): Promise<AdminUserView> {
    const user = await this.findOrThrow(userId);

    if (user.role === role) return this.toView(user);

    // Guard: never demote the last remaining ADMIN
    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return this.toView(updated);
  }

  async suspendUser(userId: string): Promise<AdminUserView> {
    await this.findOrThrow(userId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: SUSPEND_UNTIL, failedLoginAttempts: 0 },
    });

    // Force the user out of any active session
    await this.cache.del(`refresh:${userId}`).catch(() => void 0);

    return this.toView(updated);
  }

  async unsuspendUser(userId: string): Promise<AdminUserView> {
    await this.findOrThrow(userId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
    return this.toView(updated);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.findOrThrow(userId);

    // Guard: never delete the last remaining ADMIN
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin');
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.cache.del(`refresh:${userId}`).catch(() => void 0);
  }

  // ── Platform stats ────────────────────────────────────────────────────────

  async getPlatformStats(): Promise<PlatformStats> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalReviews,
      reviewsToday,
      reviews7d,
      activeReviews7d,
      activeReviewsToday,
      statusGroups,
      dailyRows,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.review.count(),
      this.prisma.review.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.review.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.review.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.review.findMany({
        where: { createdAt: { gte: startOfToday } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.review.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.review.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const reviewsByStatus = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };
    for (const g of statusGroups) {
      reviewsByStatus[g.status] = g._count._all;
    }

    return {
      totalUsers,
      activeUsersToday: activeReviewsToday.length,
      activeUsers7d: activeReviews7d.length,
      totalReviews,
      reviewsToday,
      reviews7d,
      reviewsByStatus,
      dailyReviews: this.bucketDaily(dailyRows.map((r) => r.createdAt), 30),
    };
  }

  /** Bucket review timestamps into the last `days` daily counts (oldest first). */
  private bucketDaily(timestamps: Date[], days: number): { date: string; count: number }[] {
    const buckets = new Map<string, number>();

    // Pre-seed every day so the chart never has gaps
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    for (const ts of timestamps) {
      const key = ts.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
  }

  // ── System health ─────────────────────────────────────────────────────────

  async getSystemHealth(): Promise<SystemHealth> {
    const [database, redis, gemini] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkGemini(),
    ]);

    return {
      database,
      redis,
      gemini,
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'PostgreSQL', status: 'UP', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        name: 'PostgreSQL',
        status: 'DOWN',
        message: (err as Error)?.message ?? 'connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const latencyMs = await this.cache.ping();
    if (latencyMs === null) {
      return { name: 'Redis', status: 'DOWN', message: 'unreachable' };
    }
    return {
      name: 'Redis',
      status: latencyMs > 500 ? 'DEGRADED' : 'UP',
      latencyMs,
      ...(latencyMs > 500 ? { message: 'high latency' } : {}),
    };
  }

  private checkGemini(): ServiceHealth {
    // Real upstream pings consume quota — we only verify configuration here.
    const key = this.config.get<string>('gemini.apiKey') ?? this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      return { name: 'Gemini API', status: 'DOWN', message: 'API key not configured' };
    }
    return { name: 'Gemini API', status: 'UP', message: 'API key configured' };
  }

  // ── Rate-limit monitor ────────────────────────────────────────────────────

  /**
   * Returns the configured throttler tiers. Per-user usage tracking would
   * require tapping the @nestjs/throttler Redis backend; for now we expose
   * the configured ceilings with `used: 0` so the frontend renders the
   * panels with real limit values.
   */
  getRateLimitMonitor(): RateLimitMonitor {
    // Pulled from ThrottlerModule.forRoot — keep in sync with app.module.ts.
    const baseLimit = 100;
    const windowSeconds = 15 * 60;

    const tiers: RateLimitTier[] = [
      { tier: 'USER',    limit: baseLimit,     windowSeconds, used: 0, utilization: 0 },
      { tier: 'PREMIUM', limit: baseLimit * 5, windowSeconds, used: 0, utilization: 0 },
      { tier: 'ADMIN',   limit: baseLimit * 10, windowSeconds, used: 0, utilization: 0 },
    ];

    return { tiers, topUsers: [] };
  }
}
