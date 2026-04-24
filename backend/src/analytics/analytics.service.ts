import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { IssueCategory, IssueSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, TTL } from '../cache/cache.service';
import { AnalyticsRange, rangeCutoff } from './dto/analytics-query.dto';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

export interface LanguageCount {
  language: string;
  count: number;
}

export interface TopContributor {
  userId: string;
  name: string;
  reviewCount: number;
}

export interface PersonalStats {
  range: AnalyticsRange;
  totalReviews: number;
  thisMonthReviews: number;
  completedReviews: number;
  averageScore: number | null;
  issuesByCategory: Record<IssueCategory, number>;
  issuesBySeverity: Record<IssueSeverity, number>;
  scoreTrend: ScoreTrendPoint[];
  languages: LanguageCount[];
}

export interface TeamStats {
  range: AnalyticsRange;
  teamId: string | null;
  memberCount: number;
  totalReviews: number;
  completedReviews: number;
  averageScore: number | null;
  issuesByCategory: Record<IssueCategory, number>;
  issuesBySeverity: Record<IssueSeverity, number>;
  topContributors: TopContributor[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_CATEGORY_MAP: Record<IssueCategory, number> = {
  SECURITY:      0,
  PERFORMANCE:   0,
  QUALITY:       0,
  STYLE:         0,
  DOCUMENTATION: 0,
  TESTING:       0,
  DEPENDENCIES:  0,
};

const EMPTY_SEVERITY_MAP: Record<IssueSeverity, number> = {
  CRITICAL: 0,
  HIGH:     0,
  MEDIUM:   0,
  LOW:      0,
};

function startOfMonth(d: Date): Date {
  const m = new Date(d);
  m.setDate(1);
  m.setHours(0, 0, 0, 0);
  return m;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Personal stats ──────────────────────────────────────────────────────

  async getPersonalStats(userId: string, range: AnalyticsRange): Promise<PersonalStats> {
    const cacheKey = `analytics:personal:${userId}:${range}`;
    const cached = await this.cache.get<PersonalStats>(cacheKey);
    if (cached) return cached;

    const cutoff = rangeCutoff(range);
    const som = startOfMonth(new Date());

    const [totalReviews, thisMonthReviews, rangeReviews] = await Promise.all([
      this.prisma.review.count({ where: { userId } }),
      this.prisma.review.count({ where: { userId, createdAt: { gte: som } } }),
      this.prisma.review.findMany({
        where: { userId, createdAt: { gte: cutoff } },
        select: {
          id: true,
          status: true,
          language: true,
          overallScore: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const reviewIds = rangeReviews.map((r) => r.id);

    const issues = reviewIds.length === 0
      ? []
      : await this.prisma.issue.findMany({
          where: { reviewId: { in: reviewIds } },
          select: { category: true, severity: true },
        });

    // Issues by category + severity
    const issuesByCategory = { ...EMPTY_CATEGORY_MAP };
    const issuesBySeverity = { ...EMPTY_SEVERITY_MAP };
    for (const issue of issues) {
      issuesByCategory[issue.category]++;
      issuesBySeverity[issue.severity]++;
    }

    // Score trend — one point per completed review that has a score
    // (Loose `!= null` so undefined from prisma is also treated as missing.)
    const scoreTrend: ScoreTrendPoint[] = rangeReviews
      .filter((r) => r.status === 'COMPLETED' && r.overallScore != null)
      .map((r) => ({
        date: r.createdAt.toISOString(),
        score: r.overallScore as number,
      }));

    // Average score
    const averageScore =
      scoreTrend.length === 0
        ? null
        : Math.round(scoreTrend.reduce((s, p) => s + p.score, 0) / scoreTrend.length);

    // Languages
    const languageCounts = new Map<string, number>();
    for (const r of rangeReviews) {
      languageCounts.set(r.language, (languageCounts.get(r.language) ?? 0) + 1);
    }
    const languages: LanguageCount[] = Array.from(languageCounts.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    const stats: PersonalStats = {
      range,
      totalReviews,
      thisMonthReviews,
      completedReviews: scoreTrend.length,
      averageScore,
      issuesByCategory,
      issuesBySeverity,
      scoreTrend,
      languages,
    };

    await this.cache.set(cacheKey, stats, TTL.QUERY);
    return stats;
  }

  // ── Cache invalidation ──────────────────────────────────────────────────

  /**
   * Invalidate cached analytics for a user (and any team they belong to).
   * Called from ReviewsService whenever a review is created, completed,
   * failed, or deleted so the dashboard reflects fresh data immediately.
   */
  async bustUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.cache.deletePattern(`analytics:personal:${userId}:*`),
      this.cache.deletePattern(`analytics:team:${userId}:*`),
    ]);
  }

  // ── Team stats ──────────────────────────────────────────────────────────

  async getTeamStats(userId: string, range: AnalyticsRange): Promise<TeamStats> {
    const cacheKey = `analytics:team:${userId}:${range}`;
    const cached = await this.cache.get<TeamStats>(cacheKey);
    if (cached) return cached;

    // Find the team the user belongs to (the first membership, since a user is
    // typically in one team in this MVP).
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId },
      select: { teamId: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'You are not a member of a team. Create or join a team to see team analytics.',
      );
    }

    const teamId = membership.teamId;
    const cutoff = rangeCutoff(range);

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: {
        userId: true,
        user: { select: { name: true } },
      },
    });

    const memberIds = members.map((m) => m.userId);
    const memberNameById = new Map(members.map((m) => [m.userId, m.user.name]));

    const rangeReviews = await this.prisma.review.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        overallScore: true,
      },
    });

    const reviewIds = rangeReviews.map((r) => r.id);

    const issues = reviewIds.length === 0
      ? []
      : await this.prisma.issue.findMany({
          where: { reviewId: { in: reviewIds } },
          select: { category: true, severity: true },
        });

    const issuesByCategory = { ...EMPTY_CATEGORY_MAP };
    const issuesBySeverity = { ...EMPTY_SEVERITY_MAP };
    for (const issue of issues) {
      issuesByCategory[issue.category]++;
      issuesBySeverity[issue.severity]++;
    }

    // Scored reviews → average
    const scored = rangeReviews.filter(
      (r) => r.status === 'COMPLETED' && r.overallScore !== null,
    );
    const averageScore =
      scored.length === 0
        ? null
        : Math.round(scored.reduce((s, r) => s + (r.overallScore as number), 0) / scored.length);

    // Top contributors (by review count within range)
    const perUser = new Map<string, number>();
    for (const r of rangeReviews) {
      perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + 1);
    }
    const topContributors: TopContributor[] = Array.from(perUser.entries())
      .map(([userId, reviewCount]) => ({
        userId,
        name: memberNameById.get(userId) ?? 'Unknown',
        reviewCount,
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 10);

    const stats: TeamStats = {
      range,
      teamId,
      memberCount: members.length,
      totalReviews: rangeReviews.length,
      completedReviews: scored.length,
      averageScore,
      issuesByCategory,
      issuesBySeverity,
      topContributors,
    };

    await this.cache.set(cacheKey, stats, TTL.QUERY);
    return stats;
  }
}
