import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService, TTL } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';

import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const VERIFICATION_EXPIRY_HOURS = 24;
const RESET_EXPIRY_HOURS = 1;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly mail: MailService,
  ) {}

  // ── Cache helpers (graceful — Redis outage never breaks auth) ─────

  private async cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
    } catch {
      this.logger.warn(`Redis unavailable — could not store key "${key}". Token invalidation disabled until Redis recovers.`);
    }
  }

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      return await this.cache.get<T>(key);
    } catch {
      this.logger.warn(`Redis unavailable — could not read key "${key}".`);
      return null;
    }
  }

  private async cacheDel(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch {
      this.logger.warn(`Redis unavailable — could not delete key "${key}".`);
    }
  }

  // ── Token helpers ─────────────────────────────────────────────────

  async generateTokens(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: this.config.get<string>('jwt.secret'),
          expiresIn: this.config.get<string>('jwt.accessExpiry', '7d') as any,
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>('jwt.refreshExpiry', '30d') as any,
        },
      ),
    ]);

    // Store hashed refresh token in Redis — non-fatal if Redis is down
    await this.cacheSet(`refresh:${user.id}`, hashToken(refreshToken), TTL.SESSION * 30);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  // ── Step 5: Registration & Login ──────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const verificationToken = randomUUID();
    const verificationExpiry = new Date(
      Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        verificationToken: hashToken(verificationToken),
        verificationExpiry,
      },
    });

    // Send verification email (fire-and-forget, non-blocking)
    this.mail
      .sendVerificationEmail(user.email, user.name, verificationToken)
      .catch((err: unknown) => this.logger.error('sendVerificationEmail failed', err));

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException(
        `Account locked due to too many failed attempts. Try again in ${remainingMin} minute${remainingMin === 1 ? '' : 's'}.`,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const updateData: {
        failedLoginAttempts: number;
        lockedUntil?: Date | null;
      } = { failedLoginAttempts: newAttempts };

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Check email verification
    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in. Check your inbox or request a new verification link.',
      );
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async logout(userId: string): Promise<void> {
    await this.cacheDel(`refresh:${userId}`);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // If Redis is down, stored hash will be null — skip revocation check gracefully
    const storedHash = await this.cacheGet<string>(`refresh:${payload.sub}`);
    if (storedHash !== null && storedHash !== hashToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return this.generateTokens(user);
  }

  // ── Step 6: Email Verification ────────────────────────────────────

  async verifyEmail(token: string): Promise<{ message: string }> {
    const hashed = hashToken(token);

    const user = await this.prisma.user.findFirst({
      where: { verificationToken: hashed },
    });

    if (!user) {
      throw new NotFoundException('Verification token is invalid');
    }

    if (!user.verificationExpiry || user.verificationExpiry < new Date()) {
      throw new BadRequestException(
        'Verification link has expired. Please request a new one.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    return { message: 'Email verified successfully. You can now sign in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Return generic message even if user not found (prevent enumeration)
    if (!user || user.isVerified) {
      return {
        message: 'If that email exists and is unverified, a new link has been sent.',
      };
    }

    const token = randomUUID();
    const expiry = new Date(
      Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashToken(token),
        verificationExpiry: expiry,
      },
    });

    this.mail
      .sendVerificationEmail(user.email, user.name, token)
      .catch(() => void 0);

    return {
      message: 'If that email exists and is unverified, a new link has been sent.',
    };
  }

  // ── Step 7: Password Reset ────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return genericResponse; // Never reveal whether email exists

    const token = randomUUID();
    const expiry = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashToken(token),
        resetTokenExpiry: expiry,
      },
    });

    this.mail
      .sendPasswordResetEmail(user.email, user.name, token)
      .catch(() => void 0);

    return genericResponse;
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const hashed = hashToken(token);

    const user = await this.prisma.user.findFirst({
      where: { resetToken: hashed },
    });

    if (!user) {
      throw new BadRequestException('Reset token is invalid or has already been used');
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException(
        'Reset link has expired. Please request a new one.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Invalidate existing sessions — non-fatal if Redis is down
    await this.cacheDel(`refresh:${user.id}`);

    return { message: 'Password has been reset successfully. You can now sign in.' };
  }
}
