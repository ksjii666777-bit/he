import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { OpenRouterService } from '../ai-gateway/openrouter/openrouter.service';
import { Public } from '../common/decorators/public.decorator';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latencyMs?: number };
    redis: { status: string };
    bedrock: { status: string; apiKeyConfigured: boolean; region: string };
  };
}

@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bedrock: OpenRouterService,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const dbCheck = await this.checkDatabase();
    const redisCheck = await this.checkRedis();
    const bedrockCheck = await this.checkBedrock();

    const checks = {
      database: dbCheck,
      redis: redisCheck,
      bedrock: bedrockCheck,
    };

    const allOk =
      dbCheck.status === 'ok' &&
      redisCheck.status === 'ok' &&
      bedrockCheck.status === 'ok';

    const anyDegraded =
      dbCheck.status === 'degraded' ||
      redisCheck.status === 'degraded' ||
      bedrockCheck.status === 'degraded';

    return {
      status: allOk ? 'ok' : anyDegraded ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  @Get('live')
  live() {
    return { status: 'ok', uptime: Math.floor((Date.now() - this.startTime) / 1000) };
  }

  @Get('ready')
  async ready() {
    const db = await this.checkDatabase();
    return {
      status: db.status === 'ok' ? 'ok' : 'unhealthy',
      database: db.status,
    };
  }

  private async checkDatabase(): Promise<{ status: string; latencyMs?: number }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err: any) {
      this.logger.error('Database health check failed', err.message);
      return { status: 'unhealthy' };
    }
  }

  private async checkRedis(): Promise<{ status: string }> {
    try {
      await this.redis.set('health:ping', 'pong', 5);
      const result = await this.redis.get('health:ping');
      return { status: result === 'pong' ? 'ok' : 'degraded' };
    } catch {
      return { status: 'degraded' };
    }
  }

  private async checkBedrock(): Promise<{ status: string; apiKeyConfigured: boolean; region: string }> {
    try {
      const health = await this.bedrock.healthCheck();
      return {
        status: health.status,
        apiKeyConfigured: health.apiKeyConfigured,
        region: health.region,
      };
    } catch (err: any) {
      this.logger.error('Bedrock health check failed', err.message);
      return { status: 'unhealthy', apiKeyConfigured: false, region: 'unknown' };
    }
  }
}
