import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddCollectionItemDto, CollectionItemType } from './dto/add-item.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCollectionDto) {
    const collection = await this.prisma.collection.create({
      data: { userId, name: dto.name, description: dto.description },
      include: { _count: { select: { items: true } } },
    });
    return this.formatCollection(collection);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(userId: string) {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return collections.map((c) => this.formatCollection(c));
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
        items: { orderBy: { addedAt: 'desc' } },
      },
    });

    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.userId !== userId) throw new ForbiddenException('Access denied');

    const enrichedItems = await this.enrichItems(collection.items);
    return { ...this.formatCollection(collection), items: enrichedItems };
  }

  async findByShareToken(token: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { shareToken: token },
      include: {
        _count: { select: { items: true } },
        items: { orderBy: { addedAt: 'desc' } },
      },
    });

    if (!collection) throw new NotFoundException('Collection not found');

    const enrichedItems = await this.enrichItems(collection.items);
    return { ...this.formatCollection(collection), items: enrichedItems };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, userId: string, dto: UpdateCollectionDto) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.userId !== userId) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.collection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { _count: { select: { items: true } } },
    });

    return this.formatCollection(updated);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string, userId: string): Promise<void> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.collection.delete({ where: { id } });
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  async addItem(collectionId: string, userId: string, dto: AddCollectionItemDto) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      select: { userId: true },
    });

    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.userId !== userId) throw new ForbiddenException('Access denied');

    const data: { collectionId: string; reviewId?: string; snippetId?: string } = {
      collectionId,
    };

    if (dto.type === CollectionItemType.REVIEW) {
      data.reviewId = dto.referenceId;
    } else {
      data.snippetId = dto.referenceId;
    }

    const item = await this.prisma.collectionItem.create({ data });
    const [enriched] = await this.enrichItems([item]);
    return enriched;
  }

  async removeItem(collectionId: string, itemId: string, userId: string): Promise<void> {
    const item = await this.prisma.collectionItem.findUnique({
      where: { id: itemId },
      include: { collection: { select: { userId: true } } },
    });

    if (!item || item.collectionId !== collectionId) {
      throw new NotFoundException('Item not found');
    }
    if (item.collection.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.collectionItem.delete({ where: { id: itemId } });
  }

  // ── Share ─────────────────────────────────────────────────────────────────

  async generateShareLink(id: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.userId !== userId) throw new ForbiddenException('Access denied');

    const shareToken = randomUUID();
    await this.prisma.collection.update({
      where: { id },
      data: { shareToken, isPublic: true },
    });

    return {
      shareToken,
      shareUrl: `/api/v1/collections/shared/${shareToken}`,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private formatCollection(col: any) {
    const { _count, ...rest } = col;
    return { ...rest, itemCount: _count?.items ?? 0 };
  }

  private async enrichItems(items: any[]) {
    const reviewIds = items.filter((i) => i.reviewId).map((i) => i.reviewId as string);
    const snippetIds = items
      .filter((i) => i.snippetId)
      .map((i) => i.snippetId as string);

    const [reviews, snippets] = await Promise.all([
      reviewIds.length
        ? this.prisma.review.findMany({
            where: { id: { in: reviewIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      snippetIds.length
        ? this.prisma.codeSnippet.findMany({
            where: { id: { in: snippetIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const reviewMap = new Map<string, string | null>(
      reviews.map((r): [string, string | null] => [r.id, r.title]),
    );
    const snippetMap = new Map<string, string>(
      snippets.map((s): [string, string] => [s.id, s.title]),
    );

    return items.map((item) => ({
      id: item.id,
      collectionId: item.collectionId,
      type: item.reviewId ? 'REVIEW' : 'SNIPPET',
      referenceId: (item.reviewId ?? item.snippetId) as string,
      title: item.reviewId
        ? (reviewMap.get(item.reviewId) ?? `Review ${(item.reviewId as string).slice(0, 8)}`)
        : (snippetMap.get(item.snippetId) ?? `Snippet ${(item.snippetId as string).slice(0, 8)}`),
      createdAt: item.addedAt,
    }));
  }
}
