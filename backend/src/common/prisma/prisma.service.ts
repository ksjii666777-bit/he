import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      errorFormat: 'minimal',
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (err) {
      this.logger.error('Failed to connect to database on init', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  async reconnect() {
    this.logger.warn('Attempting database reconnection...');
    try {
      await this.$disconnect();
    } catch {
      // ignore disconnect errors during reconnect
    }
    try {
      await this.$connect();
      this.logger.log('Database reconnection successful');
    } catch (err) {
      this.logger.error('Database reconnection failed', err);
    }
  }
}
