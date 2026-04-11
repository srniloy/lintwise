import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService, TTL } from './cache.service';

// ── Redis mock ─────────────────────────────────────────────────────────────
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  flushdb: jest.fn(),
  exists: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

// ── Helpers ────────────────────────────────────────────────────────────────
const mockConfigService = {
  get: jest.fn().mockReturnValue('redis://localhost:6379'),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    service.onModuleInit(); // manually trigger init (no real Redis)
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ── TTL constants ──────────────────────────────────────────────────────
  it('TTL.SESSION is 7 days in seconds', () => {
    expect(TTL.SESSION).toBe(7 * 24 * 60 * 60);
  });

  it('TTL.REVIEW is 30 days in seconds', () => {
    expect(TTL.REVIEW).toBe(30 * 24 * 60 * 60);
  });

  it('TTL.QUERY is 5 minutes in seconds', () => {
    expect(TTL.QUERY).toBe(5 * 60);
  });

  // ── get() ──────────────────────────────────────────────────────────────
  describe('get()', () => {
    it('returns null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await service.get('missing');
      expect(result).toBeNull();
    });

    it('returns parsed value when key exists', async () => {
      const payload = { id: '1', name: 'Alice' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(payload));
      const result = await service.get<typeof payload>('user:1');
      expect(result).toEqual(payload);
    });
  });

  // ── set() ──────────────────────────────────────────────────────────────
  describe('set()', () => {
    it('calls SET when no TTL provided', async () => {
      await service.set('key', { a: 1 });
      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', JSON.stringify({ a: 1 }));
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });

    it('calls SETEX when TTL provided', async () => {
      await service.set('key', { a: 1 }, 300);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith('key', 300, JSON.stringify({ a: 1 }));
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
    });
  });

  // ── del() ──────────────────────────────────────────────────────────────
  describe('del()', () => {
    it('calls DEL on the given key', async () => {
      await service.del('some-key');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('some-key');
    });
  });

  // ── reset() ───────────────────────────────────────────────────────────
  describe('reset()', () => {
    it('calls FLUSHDB', async () => {
      await service.reset();
      expect(mockRedisInstance.flushdb).toHaveBeenCalledTimes(1);
    });
  });

  // ── exists() ──────────────────────────────────────────────────────────
  describe('exists()', () => {
    it('returns true when key exists', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);
      expect(await service.exists('key')).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      mockRedisInstance.exists.mockResolvedValue(0);
      expect(await service.exists('missing')).toBe(false);
    });
  });

  // ── onModuleDestroy() ─────────────────────────────────────────────────
  describe('onModuleDestroy()', () => {
    it('calls quit() to close the connection', async () => {
      await service.onModuleDestroy();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});
