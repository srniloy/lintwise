import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 10;

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  isVerified: boolean;
  subscriptionEndDate: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────

  private sanitize(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    isVerified: boolean;
    subscriptionEndDate: Date | null;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
      subscriptionEndDate: user.subscriptionEndDate,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async findOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Profile ───────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.findOrThrow(userId);
    return this.sanitize(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    await this.findOrThrow(userId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    return this.sanitize(updated);
  }

  // ── Password ──────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.findOrThrow(userId);

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashed = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    // Invalidate existing refresh token so the user must log in again
    await this.cache.del(`refresh:${userId}`);

    return { message: 'Password changed successfully' };
  }

  // ── Account Deletion ──────────────────────────────────────────────

  async deleteAccount(
    userId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.findOrThrow(userId);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException(
        'Password is incorrect. Account deletion cancelled.',
      );
    }

    // Delete user and all cascade relations (defined in schema)
    await this.prisma.user.delete({ where: { id: userId } });

    // Clear session data
    await this.cache.del(`refresh:${userId}`);

    return { message: 'Account deleted successfully' };
  }
}
