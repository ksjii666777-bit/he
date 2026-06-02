import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [AiGatewayModule],
  controllers: [HealthController],
})
export class HealthModule {}
