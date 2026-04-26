import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Comment, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

type UserInfo = { name: string; avatarUrl: string | null };
type RawComment = Comment & { user: UserInfo; replies?: (Comment & { user: UserInfo })[] };

export interface CommentResponse {
  id: string;
  reviewId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  parentId: string | null;
  replies?: CommentResponse[];
  createdAt: string;
  updatedAt: string;
}

const EDIT_WINDOW_MS = 15 * 60 * 1_000; // 15 minutes

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapComment(c: RawComment): CommentResponse {
    return {
      id: c.id,
      reviewId: c.reviewId,
      userId: c.userId,
      authorName: c.user.name,
      ...(c.user.avatarUrl ? { authorAvatarUrl: c.user.avatarUrl } : {}),
      content: c.content,
      parentId: c.parentId,
      ...(c.replies
        ? { replies: c.replies.map((r) => this.mapComment(r as RawComment)) }
        : {}),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private readonly userSelect = { name: true, avatarUrl: true };

  // ── find all by review ────────────────────────────────────────────────────

  async findAllByReview(reviewId: string): Promise<CommentResponse[]> {
    const comments = await this.prisma.comment.findMany({
      where: { reviewId, parentId: null },
      include: {
        user: { select: this.userSelect },
        replies: {
          include: { user: { select: this.userSelect } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c) => this.mapComment(c as unknown as RawComment));
  }

  // ── create ────────────────────────────────────────────────────────────────

  async create(
    reviewId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    const comment = await this.prisma.comment.create({
      data: {
        reviewId,
        userId,
        content: dto.content,
        parentId: dto.parentId ?? null,
      },
      include: { user: { select: this.userSelect } },
    });

    // Fire-and-forget: mentions + reply notifications
    void this.handlePostCreateNotifications(comment, userId, dto).catch(() => {});

    return this.mapComment(comment as unknown as RawComment);
  }

  private async handlePostCreateNotifications(
    comment: Comment & { user: UserInfo },
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<void> {
    // Notify parent comment author on reply
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { userId: true },
      });
      if (parent && parent.userId !== authorId) {
        const review = await this.prisma.review.findUnique({
          where: { id: comment.reviewId },
          select: { id: true },
        });
        await this.notifications
          .create(
            parent.userId,
            'COMMENT_REPLY',
            'New reply to your comment',
            `${comment.user.name} replied to your comment`,
            { resourceId: review?.id, resourceType: 'review' },
          )
          .catch(() => {});
      }
    }

    // Parse @mentions: match @Word patterns
    const mentionMatches = [...dto.content.matchAll(/@(\w+)/g)];
    if (mentionMatches.length === 0) return;

    // Find team members whose name starts with any mentioned word
    const words = [...new Set(mentionMatches.map((m) => m[1].toLowerCase()))];
    const teamMembership = await this.prisma.teamMember.findFirst({
      where: { userId: authorId },
      select: { teamId: true },
    });
    if (!teamMembership) return;

    const teammates = await this.prisma.teamMember.findMany({
      where: { teamId: teamMembership.teamId, userId: { not: authorId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const notified = new Set<string>();
    for (const word of words) {
      for (const tm of teammates) {
        const nameLower = tm.user.name.toLowerCase().replace(/\s+/g, '');
        const firstWord = tm.user.name.split(' ')[0].toLowerCase();
        if (
          !notified.has(tm.user.id) &&
          (firstWord.startsWith(word) || nameLower.startsWith(word))
        ) {
          notified.add(tm.user.id);
          await this.notifications
            .create(
              tm.user.id,
              'MENTION',
              'You were mentioned',
              `${comment.user.name} mentioned you in a comment`,
              { resourceId: comment.reviewId, resourceType: 'review' },
            )
            .catch(() => {});
          await this.mail
            .sendMentionEmail(
              tm.user.email,
              tm.user.name,
              comment.user.name,
              comment.reviewId,
            )
            .catch(() => {});
        }
      }
    }
  }

  // ── update ────────────────────────────────────────────────────────────────

  async update(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponse> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, createdAt: true },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.userId !== userId) throw new ForbiddenException('You can only edit your own comments');
    if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Comments can only be edited within 15 minutes of posting');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: { user: { select: this.userSelect } },
    });
    return this.mapComment(updated as unknown as RawComment);
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async delete(commentId: string, userId: string, userRole: Role): Promise<void> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
