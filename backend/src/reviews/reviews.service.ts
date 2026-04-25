import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { CacheService, TTL } from '../cache/cache.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewFilterDto } from './dto/review-filter.dto';
import type { Review, Issue } from '@prisma/client';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly cache: CacheService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    // Line count validation (code size already enforced by DTO @MaxLength)
    const lineCount = dto.code.split('\n').length;
    if (lineCount > CreateReviewDto.MAX_CODE_LINES) {
      throw new BadRequestException(
        `Code must not exceed ${CreateReviewDto.MAX_CODE_LINES.toLocaleString()} lines`,
      );
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        title: dto.title,
        language: dto.language,
        code: dto.code,
        status: 'PENDING',
      },
    });

    // Fire-and-forget — response returns immediately with PENDING review
    this.processReview(review.id).catch((err: unknown) =>
      this.logger.error(`Background processing failed for review ${review.id}`, err),
    );

    // Invalidate cached analytics so totalReviews/thisMonthReviews update
    await this.analytics.bustUserCache(userId).catch(() => void 0);

    return review;
  }

  // ── Process (background) ──────────────────────────────────────────────────

  async processReview(reviewId: string): Promise<void> {
    // Mark as PROCESSING
    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: 'PROCESSING' },
    });

    try {
      const result = await this.gemini.analyzeCode(
        review.code,
        review.language,
        review.title ?? undefined,
      );

      // Persist issues + update review in a transaction
      await this.prisma.$transaction([
        this.prisma.issue.createMany({
          data: result.issues.map((issue) => ({
            reviewId,
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            suggestion: issue.suggestion ?? null,
            lineStart: issue.lineStart ?? null,
            lineEnd: issue.lineEnd ?? null,
            fileName: issue.fileName ?? null,
          })),
        }),
        this.prisma.review.update({
          where: { id: reviewId },
          data: {
            status: 'COMPLETED',
            overallScore: result.overallScore,
            summary: result.summary,
          },
        }),
      ]);

      this.logger.log(`Review ${reviewId} completed — score: ${result.overallScore}`);

      // Analytics cache now stale — refresh on next dashboard request
      await this.analytics.bustUserCache(review.userId).catch(() => void 0);

      // In-app notification: review complete
      void this.notifications
        .create(
          review.userId,
          'REVIEW_COMPLETED',
          'Review Complete',
          `Your code review finished with a score of ${result.overallScore}/100.`,
          { resourceId: reviewId, resourceType: 'REVIEW' },
        )
        .catch((err: unknown) => this.logger.warn(`Failed to create REVIEW_COMPLETED notification: ${String(err)}`));

      // In-app + email notification: critical issues
      const criticalCount = result.issues.filter((i) => i.severity === 'CRITICAL').length;
      if (criticalCount > 0) {
        void this.notifications
          .create(
            review.userId,
            'CRITICAL_ISSUE',
            `${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} found`,
            `Your review contains ${criticalCount} critical severity issue${criticalCount === 1 ? '' : 's'} that need immediate attention.`,
            { resourceId: reviewId, resourceType: 'REVIEW' },
          )
          .catch((err: unknown) => this.logger.warn(`Failed to create CRITICAL_ISSUE notification: ${String(err)}`));

        void this.notifications
          .sendEmailIfEnabled(review.userId, 'critical_issues', (email, name, token) =>
            this.mail.sendCriticalIssueEmail(email, name, reviewId, criticalCount, token),
          )
          .catch(() => void 0);
      }

      // Email notification: review complete (only if not sending critical issues email)
      void this.notifications
        .sendEmailIfEnabled(review.userId, 'review_complete', (email, name, token) =>
          this.mail.sendReviewCompleteEmail(email, name, reviewId, result.issues.length, token),
        )
        .catch(() => void 0);
    } catch (err: unknown) {
      await this.prisma.review
        .update({ where: { id: reviewId }, data: { status: 'FAILED' } })
        .catch(() => void 0);

      // Bust cache even on failure so the FAILED status is reflected
      await this.analytics.bustUserCache(review.userId).catch(() => void 0);

      // In-app notification: review failed
      void this.notifications
        .create(
          review.userId,
          'REVIEW_FAILED',
          'Review Failed',
          'Your code review could not be completed due to a processing error.',
          { resourceId: reviewId, resourceType: 'REVIEW' },
        )
        .catch(() => void 0);

      this.logger.error(`Review ${reviewId} failed`, err);
      throw err;
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async findAllByUser(
    userId: string,
    dto: ReviewFilterDto,
  ): Promise<{ reviews: Review[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, status, language, startDate, endDate, search } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (status) where.status = status;

    if (language) {
      where.language = { contains: language, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { language: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { reviews, total, page, limit };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getStatus(
    reviewId: string,
    userId: string,
  ): Promise<{ id: string; status: string; createdAt: Date; updatedAt: Date }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true, userId: true, createdAt: true, updatedAt: true },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Access denied');

    return { id: review.id, status: review.status, createdAt: review.createdAt, updatedAt: review.updatedAt };
  }

  async findOne(
    reviewId: string,
    userId: string,
  ): Promise<Review & { issues: Issue[] }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { issues: true },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Access denied');

    return review;
  }

  async getFullResult(
    reviewId: string,
    userId: string,
  ): Promise<Review & { issues: Issue[] }> {
    const cacheKey = `review:result:${reviewId}`;
    const cached = await this.cache.get<Review & { issues: Issue[] }>(cacheKey);
    if (cached) return cached;

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { issues: true },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Access denied');

    await this.cache.set(cacheKey, review, TTL.REVIEW);
    return review;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(reviewId: string, userId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.review.delete({ where: { id: reviewId } });
    await this.cache.del(`review:result:${reviewId}`);
    await this.analytics.bustUserCache(userId).catch(() => void 0);
  }
}
