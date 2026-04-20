import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';

@Injectable()
export class SnippetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateSnippetDto) {
    return this.prisma.$transaction(async (tx) => {
      const snippet = await tx.codeSnippet.create({
        data: { userId, title: dto.title, language: dto.language, code: dto.code },
      });
      await tx.snippetVersion.create({
        data: { snippetId: snippet.id, code: dto.code, version: 1 },
      });
      return { ...snippet, version: 1 };
    });
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(
    userId: string,
    params?: { page?: number; limit?: number; search?: string; language?: string },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { language: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.language) {
      where.language = { contains: params.language, mode: 'insensitive' };
    }

    const [snippets, total] = await Promise.all([
      this.prisma.codeSnippet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { versions: true } } },
      }),
      this.prisma.codeSnippet.count({ where }),
    ]);

    return {
      snippets: snippets.map(({ _count, ...rest }) => ({
        ...rest,
        version: _count.versions,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const snippet = await this.prisma.codeSnippet.findUnique({
      where: { id },
      include: { _count: { select: { versions: true } } },
    });

    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException('Access denied');

    const { _count, ...rest } = snippet;
    return { ...rest, version: _count.versions };
  }

  async getVersionHistory(id: string, userId: string) {
    const snippet = await this.prisma.codeSnippet.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.snippetVersion.findMany({
      where: { snippetId: id },
      orderBy: { version: 'desc' },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, userId: string, dto: UpdateSnippetDto) {
    const snippet = await this.prisma.codeSnippet.findUnique({
      where: { id },
      include: { _count: { select: { versions: true } } },
    });

    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException('Access denied');

    const currentVersion = snippet._count.versions;
    const nextVersion = currentVersion + 1;
    const codeChanged = dto.code !== undefined;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.codeSnippet.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.language !== undefined && { language: dto.language }),
          ...(dto.code !== undefined && { code: dto.code }),
        },
      });

      if (codeChanged) {
        await tx.snippetVersion.create({
          data: { snippetId: id, code: dto.code as string, version: nextVersion },
        });
      }

      return { ...updated, version: codeChanged ? nextVersion : currentVersion };
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string, userId: string): Promise<void> {
    const snippet = await this.prisma.codeSnippet.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!snippet) throw new NotFoundException('Snippet not found');
    if (snippet.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.codeSnippet.delete({ where: { id } });
  }
}
