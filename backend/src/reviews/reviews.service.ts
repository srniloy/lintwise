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
    } catch (err: unknown) {
      await this.prisma.review
        .update({ where: { id: reviewId }, data: { status: 'FAILED' } })
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
  }
}
