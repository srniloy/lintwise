import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

// ── Helpers ────────────────────────────────────────────────────────

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: 'user-1',
    name: 'Jane',
    email: 'jane@example.com',
    password: '$2b$10$placeholder',
    role: 'USER',
    avatarUrl: null,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCache = {
  del: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ──────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ── getProfile ──────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns user without password field', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('jane@example.com');
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateProfile ───────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates name and avatarUrl', async () => {
      const user = makeUser();
      const updated = { ...user, name: 'Updated Name', avatarUrl: 'https://example.com/a.png' };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/a.png',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.avatarUrl).toBe('https://example.com/a.png');
      expect(result).not.toHaveProperty('password');
    });
  });

  // ── changePassword ──────────────────────────────────────────────

  describe('changePassword', () => {
    const currentPassword = 'OldP@ss1!';
    const newPassword = 'N3wP@ss1!';

    it('hashes the new password and invalidates session', async () => {
      const hashed = await bcrypt.hash(currentPassword, 10);
      const user = makeUser({ password: hashed });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      const result = await service.changePassword('user-1', {
        currentPassword,
        newPassword,
      });

      expect(result.message).toContain('success');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(
        await bcrypt.compare(newPassword, updateCall.data.password),
      ).toBe(true);

      expect(mockCache.del).toHaveBeenCalledWith('refresh:user-1');
    });

    it('throws UnauthorizedException for wrong current password', async () => {
      const hashed = await bcrypt.hash(currentPassword, 10);
      const user = makeUser({ password: hashed });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongPass1!',
          newPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── deleteAccount ────────────────────────────────────────────────

  describe('deleteAccount', () => {
    const password = 'P@ssw0rd!';

    it('deletes user and clears session for correct password', async () => {
      const hashed = await bcrypt.hash(password, 10);
      const user = makeUser({ password: hashed });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.delete.mockResolvedValue(user);

      const result = await service.deleteAccount('user-1', password);
      expect(result.message).toContain('deleted');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mockCache.del).toHaveBeenCalledWith('refresh:user-1');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash(password, 10);
      const user = makeUser({ password: hashed });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.deleteAccount('user-1', 'WrongPass1!'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
