import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';

// ── Helpers ────────────────────────────────────────────────────────

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: 'user-1',
    name: 'Jane',
    email: 'jane@example.com',
    password: '$2b$10$hashedpassword',
    role: 'USER',
    isVerified: true,
    avatarUrl: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    verificationToken: null,
    verificationExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
};

const mockConfig = {
  get: jest.fn((key: string, def?: any) => {
    const map: Record<string, any> = {
      'jwt.secret': 'test-secret',
      'jwt.refreshSecret': 'test-refresh-secret',
      'jwt.accessExpiry': '7d',
      'jwt.refreshExpiry': '30d',
    };
    return map[key] ?? def;
  }),
};

const mockCache = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockMail = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ──────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CacheService, useValue: mockCache },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── generateTokens ──────────────────────────────────────────────

  describe('generateTokens', () => {
    it('returns access and refresh tokens', async () => {
      mockJwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokens({
        id: 'user-1',
        email: 'jane@example.com',
        role: 'USER',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockCache.set).toHaveBeenCalledWith(
        'refresh:user-1',
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  // ── register ────────────────────────────────────────────────────

  describe('register', () => {
    const dto = { name: 'Jane', email: 'jane@example.com', password: 'P@ssw0rd!' };

    it('hashes the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(makeUser());

      await service.register(dto);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      const storedPassword: string = createCall.data.password;
      expect(storedPassword).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, storedPassword)).toBe(true);
    });

    it('throws ConflictException for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('sends verification email after registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(makeUser());

      await service.register(dto);

      // Allow microtask queue to flush (fire-and-forget)
      await new Promise((r) => setTimeout(r, 0));
      expect(mockMail.sendVerificationEmail).toHaveBeenCalledWith(
        'jane@example.com',
        'Jane',
        expect.any(String),
      );
    });
  });

  // ── login ───────────────────────────────────────────────────────

  describe('login', () => {
    const validPassword = 'P@ssw0rd!';

    async function makeUserWithPassword(overrides: Partial<any> = {}) {
      const hashed = await bcrypt.hash(validPassword, 10);
      return makeUser({ password: hashed, ...overrides });
    }

    it('returns tokens for valid credentials', async () => {
      const user = await makeUserWithPassword();
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login({
        email: 'jane@example.com',
        password: validPassword,
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const user = await makeUserWithPassword();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      await expect(
        service.login({ email: 'jane@example.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for unverified account', async () => {
      const user = await makeUserWithPassword({ isVerified: false });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: 'jane@example.com', password: validPassword }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('increments failedLoginAttempts on wrong password', async () => {
      const user = await makeUserWithPassword({ failedLoginAttempts: 0 });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({
        ...user,
        failedLoginAttempts: 1,
      });

      await expect(
        service.login({ email: 'jane@example.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ failedLoginAttempts: 1 }),
      });
    });

    it('locks account after 5 failed attempts', async () => {
      const user = await makeUserWithPassword({ failedLoginAttempts: 4 });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      await expect(
        service.login({ email: 'jane@example.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(UnauthorizedException);

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.lockedUntil).toBeInstanceOf(Date);
      expect(updateCall.data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('throws ForbiddenException for locked account', async () => {
      const user = await makeUserWithPassword({
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: 'jane@example.com', password: validPassword }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'P@ssw0rd!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── verifyEmail ─────────────────────────────────────────────────

  describe('verifyEmail', () => {
    const token = 'raw-token-uuid';
    const hashed = hash(token);

    it('marks user as verified for valid token', async () => {
      const user = makeUser({
        verificationToken: hashed,
        verificationExpiry: new Date(Date.now() + 3600_000),
        isVerified: false,
      });
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, isVerified: true });

      const result = await service.verifyEmail(token);
      expect(result.message).toContain('verified');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isVerified: true }),
      });
    });

    it('throws BadRequestException for expired token', async () => {
      const user = makeUser({
        verificationToken: hashed,
        verificationExpiry: new Date(Date.now() - 1000), // past
      });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.verifyEmail(token)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail(token)).rejects.toThrow(NotFoundException);
    });
  });

  // ── forgotPassword ──────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('stores hashed reset token in DB', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      await service.forgotPassword('jane@example.com');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.resetToken).toBeDefined();
      expect(updateCall.data.resetToken).toHaveLength(64); // SHA-256 hex
      expect(updateCall.data.resetTokenExpiry).toBeInstanceOf(Date);
    });

    it('sends reset email', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      await service.forgotPassword('jane@example.com');
      await new Promise((r) => setTimeout(r, 0));

      expect(mockMail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'jane@example.com',
        'Jane',
        expect.any(String),
      );
    });

    it('returns generic success even if email not found (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@example.com');
      expect(result.message).toBeDefined();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword ────────────────────────────────────────────────

  describe('resetPassword', () => {
    const token = 'raw-reset-token';
    const hashed = hash(token);
    const newPassword = 'N3wP@ssword!';

    it('updates password and clears token on success', async () => {
      const user = makeUser({
        resetToken: hashed,
        resetTokenExpiry: new Date(Date.now() + 3600_000),
      });
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      const result = await service.resetPassword(token, newPassword);
      expect(result.message).toContain('reset');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.resetToken).toBeNull();
      expect(updateCall.data.resetTokenExpiry).toBeNull();
      expect(
        await bcrypt.compare(newPassword, updateCall.data.password),
      ).toBe(true);
    });

    it('throws BadRequestException for expired token', async () => {
      const user = makeUser({
        resetToken: hashed,
        resetTokenExpiry: new Date(Date.now() - 1000),
      });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', newPassword),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
