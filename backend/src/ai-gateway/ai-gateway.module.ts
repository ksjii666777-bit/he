import { Module } from '@nestjs/common';
import { ModelRouter } from './model-router';
import { CostGuard } from './cost-guard';
import { ContentValidator } from './validators/content-validator';
import { BedrockModule } from './bedrock/bedrock.module';
import { OpenRouterModule } from './openrouter/openrouter.module';

@Module({
  imports: [BedrockModule, OpenRouterModule],
  providers: [ModelRouter, CostGuard, ContentValidator],
  exports: [ModelRouter, CostGuard, ContentValidator, BedrockModule, OpenRouterModule],
})
export class AiGatewayModule {}
