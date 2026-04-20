import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SnippetsService } from './snippets.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSnippet(overrides: Partial<any> = {}): any {
  return {
    id: 'snippet-1',
    userId: 'user-1',
    title: 'My Snippet',
    language: 'typescript',
    code: 'const x = 1;',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    _count: { versions: 1 },
    ...overrides,
  };
}

function makeVersion(overrides: Partial<any> = {}): any {
  return {
    id: 'version-1',
    snippetId: 'snippet-1',
    code: 'const x = 1;',
    version: 1,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  codeSnippet: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  snippetVersion: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn: any) =>
    typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn),
  ),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('SnippetsService', () => {
  let service: SnippetsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation((fn: any) =>
      typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnippetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SnippetsService>(SnippetsService);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a snippet and version 1 in a transaction', async () => {
      const dto = { title: 'My Snippet', language: 'typescript', code: 'const x = 1;' };
      const snippet = makeSnippet({ _count: undefined });

      mockPrisma.codeSnippet.create.mockResolvedValue(snippet);
      mockPrisma.snippetVersion.create.mockResolvedValue(makeVersion());

      const result = await service.create('user-1', dto);

      expect(mockPrisma.codeSnippet.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: dto.title, language: dto.language, code: dto.code },
      });
      expect(mockPrisma.snippetVersion.create).toHaveBeenCalledWith({
        data: { snippetId: snippet.id, code: dto.code, version: 1 },
      });
      expect(result.version).toBe(1);
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated snippets with version count', async () => {
      const snippets = [
        makeSnippet({ _count: { versions: 3 } }),
        makeSnippet({ id: 'snippet-2', _count: { versions: 1 } }),
      ];
      mockPrisma.codeSnippet.findMany.mockResolvedValue(snippets);
      mockPrisma.codeSnippet.count.mockResolvedValue(2);

      const result = await service.findAll('user-1', { page: 1, limit: 10 });

      expect(result.snippets).toHaveLength(2);
      expect(result.snippets[0].version).toBe(3);
      expect(result.snippets[1].version).toBe(1);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns snippet with version count for the owner', async () => {
      const snippet = makeSnippet({ _count: { versions: 2 } });
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);

      const result = await service.findOne('snippet-1', 'user-1');

      expect(result.id).toBe('snippet-1');
      expect(result.version).toBe(2);
    });

    it('throws NotFoundException when snippet does not exist', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a different user', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(makeSnippet({ userId: 'user-1' }));

      await expect(service.findOne('snippet-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('creates a new version when code changes', async () => {
      const snippet = makeSnippet({ _count: { versions: 1 } });
      const dto = { code: 'const x = 2;' };

      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);
      mockPrisma.codeSnippet.update.mockResolvedValue({
        ...snippet,
        code: 'const x = 2;',
        _count: undefined,
      });
      mockPrisma.snippetVersion.create.mockResolvedValue(makeVersion({ version: 2 }));

      const result = await service.update('snippet-1', 'user-1', dto);

      expect(mockPrisma.snippetVersion.create).toHaveBeenCalledWith({
        data: { snippetId: 'snippet-1', code: 'const x = 2;', version: 2 },
      });
      expect(result.version).toBe(2);
    });

    it('does not create a new version when only title changes', async () => {
      const snippet = makeSnippet({ _count: { versions: 1 } });
      const dto = { title: 'New Title' };

      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);
      mockPrisma.codeSnippet.update.mockResolvedValue({
        ...snippet,
        title: 'New Title',
        _count: undefined,
      });

      const result = await service.update('snippet-1', 'user-1', dto);

      expect(mockPrisma.snippetVersion.create).not.toHaveBeenCalled();
      expect(result.version).toBe(1);
    });

    it('throws ForbiddenException for wrong owner', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(makeSnippet({ userId: 'user-1' }));

      await expect(service.update('snippet-1', 'other-user', { title: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── getVersionHistory() ───────────────────────────────────────────────────

  describe('getVersionHistory()', () => {
    it('returns versions in descending order for the owner', async () => {
      const versions = [
        makeVersion({ id: 'v3', version: 3 }),
        makeVersion({ id: 'v2', version: 2 }),
        makeVersion({ id: 'v1', version: 1 }),
      ];

      mockPrisma.codeSnippet.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.snippetVersion.findMany.mockResolvedValue(versions);

      const result = await service.getVersionHistory('snippet-1', 'user-1');

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(mockPrisma.snippetVersion.findMany).toHaveBeenCalledWith({
        where: { snippetId: 'snippet-1' },
        orderBy: { version: 'desc' },
      });
    });

    it('throws ForbiddenException for wrong owner', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue({ userId: 'user-1' });

      await expect(service.getVersionHistory('snippet-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── delete() ──────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('deletes the snippet for the owner', async () => {
      const snippet = makeSnippet();
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);
      mockPrisma.codeSnippet.delete.mockResolvedValue(snippet);

      await service.delete('snippet-1', 'user-1');

      expect(mockPrisma.codeSnippet.delete).toHaveBeenCalledWith({
        where: { id: 'snippet-1' },
      });
    });

    it('throws NotFoundException when snippet does not exist', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.codeSnippet.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for wrong owner', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(makeSnippet({ userId: 'user-1' }));

      await expect(service.delete('snippet-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.codeSnippet.delete).not.toHaveBeenCalled();
    });
  });
});
