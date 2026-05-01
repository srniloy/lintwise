import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

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
    groupBy: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockCache = {
  del: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue(5),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'gemini.apiKey') return 'test-gemini-key';
    return undefined;
  }),
};

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
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
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ── getAllUsers ───────────────────────────────────────────────────────────

  describe('getAllUsers()', () => {
    it('returns a paginated users list with totalPages', async () => {
      mockPrisma.user.findMany.mockResolvedValue([makeUser({ id: 'a' }), makeUser({ id: 'b' })]);
      mockPrisma.user.count.mockResolvedValue(45);

      const result = await service.getAllUsers({ page: 2, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('filters by role when provided', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getAllUsers({ role: 'PREMIUM' as any });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'PREMIUM' } }),
      );
    });

    it('searches name and email case-insensitively when search is provided', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getAllUsers({ search: 'alice' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('flags suspended users when lockedUntil is in the future', async () => {
      const future = new Date(Date.now() + 60_000);
      mockPrisma.user.findMany.mockResolvedValue([
        makeUser({ id: 'active' }),
        makeUser({ id: 'suspended', lockedUntil: future }),
      ]);
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await service.getAllUsers({});

      expect(result.data[0].isSuspended).toBe(false);
      expect(result.data[1].isSuspended).toBe(true);
    });
  });

  // ── updateUserRole ────────────────────────────────────────────────────────

  describe('updateUserRole()', () => {
    it('promotes a USER to PREMIUM', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'USER' }));
      mockPrisma.user.update.mockResolvedValue(makeUser({ role: 'PREMIUM' }));

      const result = await service.updateUserRole('user-1', 'PREMIUM' as any);

      expect(result.role).toBe('PREMIUM');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'PREMIUM' },
      });
    });

    it('throws NotFoundException for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserRole('missing', 'PREMIUM' as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to demote the last remaining ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateUserRole('user-1', 'USER' as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('allows demoting an ADMIN when other admins exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      mockPrisma.user.count.mockResolvedValue(3);
      mockPrisma.user.update.mockResolvedValue(makeUser({ role: 'USER' }));

      const result = await service.updateUserRole('user-1', 'USER' as any);

      expect(result.role).toBe('USER');
    });

    it('is a no-op when the new role matches the current role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'PREMIUM' }));

      const result = await service.updateUserRole('user-1', 'PREMIUM' as any);

      expect(result.role).toBe('PREMIUM');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── suspendUser / unsuspendUser ───────────────────────────────────────────

  describe('suspendUser()', () => {
    it('sets lockedUntil to a far-future date', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      mockPrisma.user.update.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve(makeUser({ lockedUntil: data.lockedUntil })),
      );

      const result = await service.suspendUser('user-1');

      const callArgs = mockPrisma.user.update.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: 'user-1' });
      expect(callArgs.data.lockedUntil).toBeInstanceOf(Date);
      expect((callArgs.data.lockedUntil as Date).getTime()).toBeGreaterThan(Date.now());
      expect(result.isSuspended).toBe(true);
      expect(mockCache.del).toHaveBeenCalledWith('refresh:user-1');
    });

    it('throws NotFoundException for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.suspendUser('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unsuspendUser()', () => {
    it('clears lockedUntil and resets failed login attempts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ lockedUntil: new Date() }));
      mockPrisma.user.update.mockResolvedValue(makeUser({ lockedUntil: null }));

      const result = await service.unsuspendUser('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lockedUntil: null, failedLoginAttempts: 0 },
      });
      expect(result.isSuspended).toBe(false);
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser()', () => {
    it('hard-deletes a normal user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'USER' }));
      mockPrisma.user.delete.mockResolvedValue(undefined);

      await service.deleteUser('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(mockCache.del).toHaveBeenCalledWith('refresh:user-1');
    });

    it('refuses to delete the last remaining ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(service.deleteUser('user-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteUser('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPlatformStats ──────────────────────────────────────────────────────

  describe('getPlatformStats()', () => {
    it('returns the full frontend stats shape with status and daily breakdowns', async () => {
      mockPrisma.user.count.mockResolvedValue(120);
      mockPrisma.review.count
        .mockResolvedValueOnce(900) // totalReviews
        .mockResolvedValueOnce(12)  // reviewsToday
        .mockResolvedValueOnce(80); // reviews7d
      mockPrisma.review.findMany
        .mockResolvedValueOnce([{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]) // active 7d
        .mockResolvedValueOnce([{ userId: 'a' }])                                    // active today
        .mockResolvedValueOnce([
          { createdAt: new Date() },
          { createdAt: new Date() },
        ]);                                                                          // 30-day timestamps
      mockPrisma.review.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { _all: 700 } },
        { status: 'PROCESSING', _count: { _all: 5 } },
        { status: 'FAILED', _count: { _all: 10 } },
      ]);

      const result = await service.getPlatformStats();

      expect(result.totalUsers).toBe(120);
      expect(result.totalReviews).toBe(900);
      expect(result.reviewsToday).toBe(12);
      expect(result.reviews7d).toBe(80);
      expect(result.activeUsers7d).toBe(3);
      expect(result.activeUsersToday).toBe(1);
      expect(result.reviewsByStatus).toEqual({
        PENDING: 0,
        PROCESSING: 5,
        COMPLETED: 700,
        FAILED: 10,
      });
      expect(result.dailyReviews).toHaveLength(30);
      expect(result.dailyReviews[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ── getSystemHealth ───────────────────────────────────────────────────────

  describe('getSystemHealth()', () => {
    it('returns UP for all checks when DB, Redis, and Gemini key are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(3);

      const result = await service.getSystemHealth();

      expect(result.database.status).toBe('UP');
      expect(result.redis.status).toBe('UP');
      expect(result.gemini.status).toBe('UP');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('marks Redis DEGRADED when latency exceeds 500ms', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(750);

      const result = await service.getSystemHealth();
      expect(result.redis.status).toBe('DEGRADED');
      expect(result.redis.latencyMs).toBe(750);
    });

    it('marks Redis DOWN when ping returns null', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(null);

      const result = await service.getSystemHealth();
      expect(result.redis.status).toBe('DOWN');
    });

    it('marks Database DOWN when the query throws', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockCache.ping.mockResolvedValue(3);

      const result = await service.getSystemHealth();
      expect(result.database.status).toBe('DOWN');
      expect(result.database.message).toMatch(/connection/i);
    });

    it('marks Gemini DOWN when no API key is configured', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(3);
      mockConfig.get.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

      const result = await service.getSystemHealth();
      expect(result.gemini.status).toBe('DOWN');
    });
  });

  // ── getRateLimitMonitor ───────────────────────────────────────────────────

  describe('getRateLimitMonitor()', () => {
    it('returns three configured tiers with empty topUsers', () => {
      const result = service.getRateLimitMonitor();

      expect(result.tiers).toHaveLength(3);
      expect(result.tiers.map((t) => t.tier)).toEqual(['USER', 'PREMIUM', 'ADMIN']);
      expect(result.tiers[0].limit).toBeGreaterThan(0);
      expect(result.tiers[0].windowSeconds).toBeGreaterThan(0);
      expect(result.topUsers).toEqual([]);
    });
  });
});
