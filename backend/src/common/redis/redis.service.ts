import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private readonly defaultTtl: number;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.defaultTtl = parseInt(config.get<string>('REDIS_TTL') || '3600', 10);
    this.enabled = config.get<string>('REDIS_URL') ? true : false;

    if (this.enabled) {
      const url = config.get<string>('REDIS_URL') || 'redis://localhost:6379';
      this.client = new Redis(url, {
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        maxRetriesPerRequest: 3,
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis connection error', err.message);
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
      });
    }
  }

  async onModuleInit() {
    if (this.enabled) {
      try {
        await this.client.connect();
      } catch (err: any) {
        this.logger.warn(`Redis connection failed, using fallback: ${err.message}`);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.enabled || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      const seconds = ttl || this.defaultTtl;
      await this.client.setex(key, seconds, value);
    } catch (err: any) {
      this.logger.warn(`Redis set failed: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del failed: ${err.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async hset(key: string, fields: Record<string, string>): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.hset(key, fields);
    } catch (err: any) {
      this.logger.warn(`Redis hset failed: ${err.message}`);
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.enabled || !this.client) return null;
    try {
      const result = await this.client.hgetall(key);
      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.hdel(key, field);
    } catch (err: any) {
      this.logger.warn(`Redis hdel failed: ${err.message}`);
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.expire(key, ttl);
    } catch (err: any) {
      this.logger.warn(`Redis expire failed: ${err.message}`);
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
