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

const USER_ID = 'e2e-snip-user-1';
const OTHER_USER_ID = 'e2e-snip-user-2';
const SNIPPET_ID = 'e2e-snippet-1';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSnippet(overrides: Partial<any> = {}): any {
  return {
    id: SNIPPET_ID,
    userId: USER_ID,
    title: 'E2E Snippet',
    language: 'typescript',
    code: 'const x = 1;',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    version: 1,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<any> = {}): any {
  return {
    id: 'e2e-version-1',
    snippetId: SNIPPET_ID,
    code: 'const x = 1;',
    version: 1,
    createdAt: new Date('2024-01-15T10:00:00Z'),
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
  // Needed by AppModule providers
  review: { findMany: jest.fn() },
  collection: {},
  collectionItem: {},
};

const mockGemini = { analyzeCode: jest.fn() };
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  deletePattern: jest.fn().mockResolvedValue(undefined),
};
const mockMail = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Snippets (e2e)', () => {
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
    mockPrisma.$transaction.mockImplementation((fn: any) =>
      typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn),
    );
    mockCache.get.mockResolvedValue(null);
    mockPrisma.review.findMany.mockResolvedValue([]);
  });

  // ── POST /api/v1/snippets ─────────────────────────────────────────────────

  describe('POST /api/v1/snippets', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/snippets')
        .send({ title: 'Test', language: 'ts', code: 'x' })
        .expect(401);
    });

    it('returns 201 with the created snippet', async () => {
      const snippet = makeSnippet();
      mockPrisma.codeSnippet.create.mockResolvedValue(snippet);
      mockPrisma.snippetVersion.create.mockResolvedValue(makeVersion());

      const res = await request(app.getHttpServer())
        .post('/api/v1/snippets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'E2E Snippet', language: 'typescript', code: 'const x = 1;' })
        .expect(201);

      expect(res.body.data.title).toBe('E2E Snippet');
      expect(res.body.data.version).toBe(1);
    });

    it('returns 400 when title is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/snippets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ language: 'typescript', code: 'const x = 1;' })
        .expect(400);
    });
  });

  // ── GET /api/v1/snippets ──────────────────────────────────────────────────

  describe('GET /api/v1/snippets', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/snippets').expect(401);
    });

    it('returns 200 with paginated snippet list', async () => {
      const snippets = [makeSnippet({ _count: { versions: 1 } })];
      mockPrisma.codeSnippet.findMany.mockResolvedValue(snippets);
      mockPrisma.codeSnippet.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/snippets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.snippets).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
    });
  });

  // ── GET /api/v1/snippets/:id ──────────────────────────────────────────────

  describe('GET /api/v1/snippets/:id', () => {
    it('returns 200 for the owner', async () => {
      const snippet = makeSnippet({ _count: { versions: 1 } });
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/snippets/${SNIPPET_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(SNIPPET_ID);
    });

    it('returns 403 for a different user', async () => {
      const snippet = makeSnippet({ _count: { versions: 1 } });
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);

      return request(app.getHttpServer())
        .get(`/api/v1/snippets/${SNIPPET_ID}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('returns 404 when snippet does not exist', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/snippets/bad-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // ── PUT /api/v1/snippets/:id ──────────────────────────────────────────────

  describe('PUT /api/v1/snippets/:id', () => {
    it('returns 200 with updated snippet and incremented version', async () => {
      const snippet = makeSnippet({ _count: { versions: 1 } });
      const updated = { ...snippet, code: 'const x = 2;', _count: undefined };

      mockPrisma.codeSnippet.findUnique.mockResolvedValue(snippet);
      mockPrisma.codeSnippet.update.mockResolvedValue(updated);
      mockPrisma.snippetVersion.create.mockResolvedValue(makeVersion({ version: 2 }));

      const res = await request(app.getHttpServer())
        .put(`/api/v1/snippets/${SNIPPET_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ code: 'const x = 2;' })
        .expect(200);

      expect(res.body.data.version).toBe(2);
    });
  });

  // ── GET /api/v1/snippets/:id/versions ────────────────────────────────────

  describe('GET /api/v1/snippets/:id/versions', () => {
    it('returns 200 list of versions in descending order', async () => {
      const versions = [
        makeVersion({ id: 'v2', version: 2 }),
        makeVersion({ id: 'v1', version: 1 }),
      ];
      mockPrisma.codeSnippet.findUnique.mockResolvedValue({ userId: USER_ID });
      mockPrisma.snippetVersion.findMany.mockResolvedValue(versions);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/snippets/${SNIPPET_ID}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].version).toBe(2);
    });
  });

  // ── DELETE /api/v1/snippets/:id ───────────────────────────────────────────

  describe('DELETE /api/v1/snippets/:id', () => {
    it('returns 204 for the owner', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(makeSnippet());
      mockPrisma.codeSnippet.delete.mockResolvedValue({});

      return request(app.getHttpServer())
        .delete(`/api/v1/snippets/${SNIPPET_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });

    it('returns 404 after delete (snippet no longer exists)', async () => {
      mockPrisma.codeSnippet.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get(`/api/v1/snippets/${SNIPPET_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
