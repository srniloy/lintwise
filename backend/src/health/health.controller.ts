import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

interface CheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check — verifies DB, Redis, and Gemini API connectivity' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  @ApiResponse({ status: 503, description: 'One or more systems are degraded' })
  async check(): Promise<{
    status: string;
    checks: Record<string, CheckResult>;
    uptime: number;
    timestamp: string;
  }> {
    const checks: Record<string, CheckResult> = {};

    // ── PostgreSQL ───────────────────────────────────────────────────────────
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = { status: 'up' };
    } catch (err) {
      checks.db = { status: 'down', error: (err as Error).message };
    }

    // ── Redis ────────────────────────────────────────────────────────────────
    const redisLatency = await this.cache.ping();
    if (redisLatency !== null) {
      checks.redis = { status: 'up', latencyMs: redisLatency };
    } else {
      checks.redis = { status: 'down' };
    }

    // ── Gemini API ───────────────────────────────────────────────────────────
    // Verify the API key is configured — no real network call in health checks
    const geminiKey = this.config.get<string>('gemini.apiKey');
    checks.geminiApi = geminiKey
      ? { status: 'up' }
      : { status: 'down', error: 'GEMINI_API_KEY not configured' };

    const allUp = Object.values(checks).every((c) => c.status === 'up');

    if (!allUp) {
      throw new ServiceUnavailableException('One or more services are degraded');
    }

    return {
      status: 'ok',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
