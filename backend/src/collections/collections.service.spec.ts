import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionItemType } from './dto/add-item.dto';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeCollection(overrides: Partial<any> = {}): any {
  return {
    id: 'col-1',
    userId: 'user-1',
    name: 'My Collection',
    description: null,
    isPublic: false,
    shareToken: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    _count: { items: 0 },
    ...overrides,
  };
}

function makeItem(overrides: Partial<any> = {}): any {
  return {
    id: 'item-1',
    collectionId: 'col-1',
    reviewId: 'review-1',
    snippetId: null,
    addedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  collection: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  collectionItem: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
  },
  codeSnippet: {
    findMany: jest.fn(),
  },
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CollectionsService', () => {
  let service: CollectionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default enrichItems helpers return empty arrays
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.codeSnippet.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a collection owned by the user', async () => {
      const collection = makeCollection();
      mockPrisma.collection.create.mockResolvedValue(collection);

      const result = await service.create('user-1', { name: 'My Collection' });

      expect(mockPrisma.collection.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'My Collection', description: undefined },
        include: { _count: { select: { items: true } } },
      });
      expect(result.name).toBe('My Collection');
      expect(result.itemCount).toBe(0);
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all collections for the user with item counts', async () => {
      const collections = [
        makeCollection({ _count: { items: 3 } }),
        makeCollection({ id: 'col-2', _count: { items: 0 } }),
      ];
      mockPrisma.collection.findMany.mockResolvedValue(collections);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].itemCount).toBe(3);
      expect(result[1].itemCount).toBe(0);
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns collection with enriched items for the owner', async () => {
      const item = makeItem({ reviewId: 'review-1' });
      const collection = makeCollection({ items: [item], _count: { items: 1 } });

      mockPrisma.collection.findUnique.mockResolvedValue(collection);
      mockPrisma.review.findMany.mockResolvedValue([
        { id: 'review-1', title: 'Test Review' },
      ]);

      const result = await service.findOne('col-1', 'user-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('REVIEW');
      expect(result.items[0].title).toBe('Test Review');
      expect(result.items[0].referenceId).toBe('review-1');
    });

    it('throws NotFoundException when collection does not exist', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a different user', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ items: [] }));

      await expect(service.findOne('col-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── addItem() ─────────────────────────────────────────────────────────────

  describe('addItem()', () => {
    it('adds a review item to the collection', async () => {
      const item = makeItem({ reviewId: 'review-1', snippetId: null });
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.collectionItem.create.mockResolvedValue(item);
      mockPrisma.review.findMany.mockResolvedValue([
        { id: 'review-1', title: 'My Review' },
      ]);

      const dto = { type: CollectionItemType.REVIEW, referenceId: 'review-1' };
      const result = await service.addItem('col-1', 'user-1', dto as any);

      expect(mockPrisma.collectionItem.create).toHaveBeenCalledWith({
        data: { collectionId: 'col-1', reviewId: 'review-1' },
      });
      expect(result.type).toBe('REVIEW');
      expect(result.title).toBe('My Review');
    });

    it('adds a snippet item to the collection', async () => {
      const item = makeItem({ reviewId: null, snippetId: 'snippet-1' });
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.collectionItem.create.mockResolvedValue(item);
      mockPrisma.codeSnippet.findMany.mockResolvedValue([
        { id: 'snippet-1', title: 'My Snippet' },
      ]);

      const dto = { type: CollectionItemType.SNIPPET, referenceId: 'snippet-1' };
      const result = await service.addItem('col-1', 'user-1', dto as any);

      expect(mockPrisma.collectionItem.create).toHaveBeenCalledWith({
        data: { collectionId: 'col-1', snippetId: 'snippet-1' },
      });
      expect(result.type).toBe('SNIPPET');
    });

    it('throws ForbiddenException for wrong owner', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: 'user-1' });

      const dto = { type: CollectionItemType.REVIEW, referenceId: 'review-1' };
      await expect(service.addItem('col-1', 'other-user', dto as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── removeItem() ──────────────────────────────────────────────────────────

  describe('removeItem()', () => {
    it('removes an item for the collection owner', async () => {
      const item = makeItem({ collection: { userId: 'user-1' } });
      mockPrisma.collectionItem.findUnique.mockResolvedValue(item);
      mockPrisma.collectionItem.delete.mockResolvedValue(item);

      await service.removeItem('col-1', 'item-1', 'user-1');

      expect(mockPrisma.collectionItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.collectionItem.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('col-1', 'bad-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── generateShareLink() ───────────────────────────────────────────────────

  describe('generateShareLink()', () => {
    it('sets isPublic = true and returns a shareToken and URL', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.collection.update.mockResolvedValue(makeCollection({ isPublic: true }));

      const result = await service.generateShareLink('col-1', 'user-1');

      expect(mockPrisma.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'col-1' },
          data: expect.objectContaining({ isPublic: true }),
        }),
      );
      expect(result.shareToken).toBeDefined();
      expect(result.shareUrl).toContain(result.shareToken);
    });

    it('throws ForbiddenException for wrong owner', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: 'user-1' });

      await expect(service.generateShareLink('col-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── findByShareToken() ────────────────────────────────────────────────────

  describe('findByShareToken()', () => {
    it('returns a collection without requiring auth (public access)', async () => {
      const collection = makeCollection({
        isPublic: true,
        shareToken: 'some-token',
        items: [],
        _count: { items: 0 },
      });
      mockPrisma.collection.findUnique.mockResolvedValue(collection);

      const result = await service.findByShareToken('some-token');

      expect(result.name).toBe('My Collection');
      expect(result.shareToken).toBe('some-token');
      expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shareToken: 'some-token' } }),
      );
    });

    it('throws NotFoundException for an unknown token', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      await expect(service.findByShareToken('bad-token')).rejects.toThrow(NotFoundException);
    });
  });
});
