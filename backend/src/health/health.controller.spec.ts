import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';

import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockCache = {
  ping: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health — all services up', () => {
    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(5);
      mockConfig.get.mockReturnValue('test-gemini-key');
    });

    it('returns 200 with status ok and all checks up', async () => {
      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.checks.db.status).toBe('up');
      expect(result.checks.redis.status).toBe('up');
      expect(result.checks.redis.latencyMs).toBe(5);
      expect(result.checks.geminiApi.status).toBe('up');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('GET /health — DB down', () => {
    beforeEach(() => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockCache.ping.mockResolvedValue(5);
      mockConfig.get.mockReturnValue('test-gemini-key');
    });

    it('throws ServiceUnavailableException when DB is down', async () => {
      await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws with 503 status', async () => {
      try {
        await controller.check();
        fail('should have thrown');
      } catch (err) {
        expect((err as ServiceUnavailableException).getStatus()).toBe(503);
      }
    });
  });

  describe('GET /health — Redis down', () => {
    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(null); // null = Redis unreachable
      mockConfig.get.mockReturnValue('test-gemini-key');
    });

    it('throws ServiceUnavailableException when Redis is down', async () => {
      await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('GET /health — Gemini API key missing', () => {
    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockCache.ping.mockResolvedValue(3);
      mockConfig.get.mockReturnValue(undefined); // key not configured
    });

    it('throws ServiceUnavailableException when Gemini API key is missing', async () => {
      await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
