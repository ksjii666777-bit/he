import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('dau')
  async getDau(@Query('days') days?: string) {
    return this.metrics.getDau(parseInt(days || '7'));
  }

  @Get('retention')
  async getRetention(@Query('cohort') cohort?: string) {
    return this.metrics.getRetention(cohort || new Date().toISOString().slice(0, 10));
  }

  @Get('lesson-completion')
  async getLessonCompletion(@Query('days') days?: string) {
    const rate = await this.metrics.getLessonCompletionRate(parseInt(days || '7'));
    return { rate };
  }

  @Get('conversation-minutes')
  async getConversationMinutes(@Query('days') days?: string) {
    const minutes = await this.metrics.getTotalConversationMinutes(parseInt(days || '7'));
    return { minutes };
  }

  @Get('pronunciation')
  async getPronunciation(@Query('days') days?: string) {
    const score = await this.metrics.getPronunciationImprovement(parseInt(days || '7'));
    return { averagePronunciationScore: score };
  }
}
