import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// TTL constants (in seconds)
export const TTL = {
  /** User sessions — 7 days */
  SESSION: 7 * 24 * 60 * 60,
  /** Review results — 30 days */
  REVIEW: 30 * 24 * 60 * 60,
  /** Short-lived DB query cache — 5 minutes */
  QUERY: 5 * 60,
  /** Auth tokens — 7 days (matches JWT access expiry) */
  TOKEN: 7 * 24 * 60 * 60,
} as const;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.config.get<string>('redis.url', 'redis://localhost:6379');
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err: Error) =>
      this.logger.error('Redis error', err.message),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) return null;
    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async reset(): Promise<void> {
    await this.client.flushdb();
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }
}
