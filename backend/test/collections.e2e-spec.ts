import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/gemini/gemini.service';
import { CacheService } from '../src/cache/cache.service';

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = 'e2e-col-user-1';
const OTHER_USER_ID = 'e2e-col-user-2';
const COL_ID = 'e2e-col-1';
const ITEM_ID = 'e2e-item-1';
const SHARE_TOKEN = 'share-token-abc';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeCollection(overrides: Partial<any> = {}): any {
  return {
    id: COL_ID,
    userId: USER_ID,
    name: 'E2E Collection',
    description: null,
    isPublic: false,
    shareToken: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    _count: { items: 0 },
    ...overrides,
  };
}

function makeItem(overrides: Partial<any> = {}): any {
  return {
    id: ITEM_ID,
    collectionId: COL_ID,
    reviewId: 'review-1',
    snippetId: null,
    addedAt: new Date('2024-01-15T10:00:00Z'),
    collection: { userId: USER_ID },
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
  review: { findMany: jest.fn() },
  codeSnippet: { findMany: jest.fn() },
  // Needed by other modules
  codeSnippet2: {},
  snippetVersion: { create: jest.fn(), findMany: jest.fn() },
};

const mockGemini = { analyzeCode: jest.fn() };
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Collections (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService).useValue(mockPrisma)
      .overrideProvider(GeminiService).useValue(mockGemini)
      .overrideProvider(CacheService).useValue(mockCache)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    ownerToken = await jwtService.signAsync({ sub: USER_ID, email: 'owner@test.test', role: 'USER' });
    otherToken = await jwtService.signAsync({ sub: OTHER_USER_ID, email: 'other@test.test', role: 'USER' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.codeSnippet.findMany.mockResolvedValue([]);
  });

  // ── POST /api/v1/collections ──────────────────────────────────────────────

  describe('POST /api/v1/collections', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/collections')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('returns 201 with the created collection', async () => {
      const collection = makeCollection();
      mockPrisma.collection.create.mockResolvedValue(collection);

      const res = await request(app.getHttpServer())
        .post('/api/v1/collections')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'E2E Collection' })
        .expect(201);

      expect(res.body.data.name).toBe('E2E Collection');
      expect(res.body.data.itemCount).toBe(0);
    });

    it('returns 400 when name is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/collections')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ description: 'no name' })
        .expect(400);
    });
  });

  // ── GET /api/v1/collections ───────────────────────────────────────────────

  describe('GET /api/v1/collections', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/collections').expect(401);
    });

    it('returns 200 with list of collections', async () => {
      mockPrisma.collection.findMany.mockResolvedValue([makeCollection()]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/collections')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  // ── POST /api/v1/collections/:id/items ───────────────────────────────────

  describe('POST /api/v1/collections/:id/items', () => {
    it('returns 201 when adding a review item', async () => {
      const item = makeItem();
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: USER_ID });
      mockPrisma.collectionItem.create.mockResolvedValue(item);
      mockPrisma.review.findMany.mockResolvedValue([{ id: 'review-1', title: 'My Review' }]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/collections/${COL_ID}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ type: 'REVIEW', referenceId: 'review-1' })
        .expect(201);

      expect(res.body.data.type).toBe('REVIEW');
      expect(res.body.data.title).toBe('My Review');
    });

    it('returns 400 with invalid type', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/collections/${COL_ID}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ type: 'INVALID', referenceId: 'some-id' })
        .expect(400);
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/collections/${COL_ID}/items`)
        .send({ type: 'REVIEW', referenceId: 'review-1' })
        .expect(401);
    });
  });

  // ── DELETE /api/v1/collections/:id/items/:itemId ─────────────────────────

  describe('DELETE /api/v1/collections/:id/items/:itemId', () => {
    it('returns 204 when removing an item', async () => {
      mockPrisma.collectionItem.findUnique.mockResolvedValue(makeItem());
      mockPrisma.collectionItem.delete.mockResolvedValue({});

      return request(app.getHttpServer())
        .delete(`/api/v1/collections/${COL_ID}/items/${ITEM_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });

    it('returns 403 for a different user', async () => {
      mockPrisma.collectionItem.findUnique.mockResolvedValue(makeItem());

      return request(app.getHttpServer())
        .delete(`/api/v1/collections/${COL_ID}/items/${ITEM_ID}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  // ── POST /api/v1/collections/:id/share ───────────────────────────────────

  describe('POST /api/v1/collections/:id/share', () => {
    it('returns 200 with shareToken and shareUrl', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue({ userId: USER_ID });
      mockPrisma.collection.update.mockResolvedValue(
        makeCollection({ shareToken: SHARE_TOKEN, isPublic: true }),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/collections/${COL_ID}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.data.shareToken).toBeDefined();
      expect(res.body.data.shareUrl).toBeDefined();
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/collections/${COL_ID}/share`)
        .expect(401);
    });
  });

  // ── GET /api/v1/collections/shared/:token ────────────────────────────────

  describe('GET /api/v1/collections/shared/:token', () => {
    it('returns 200 without requiring auth', async () => {
      const collection = makeCollection({
        isPublic: true,
        shareToken: SHARE_TOKEN,
        items: [],
        _count: { items: 0 },
      });
      mockPrisma.collection.findUnique.mockResolvedValue(collection);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/collections/shared/${SHARE_TOKEN}`)
        .expect(200);

      expect(res.body.data.name).toBe('E2E Collection');
    });

    it('returns 404 for an unknown token', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/collections/shared/bad-token')
        .expect(404);
    });
  });
});
