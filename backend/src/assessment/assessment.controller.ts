import { Controller, Post, Get, Param, Query, Req } from '@nestjs/common';
import { SpeakingScoreService } from './speaking-score.service';
import { ProgressTrackerService } from './progress-tracker.service';
import { StatisticsService } from './statistics.service';
import { DashboardService } from './dashboard.service';

@Controller('assessment')
export class AssessmentController {
  constructor(
    private readonly speakingScore: SpeakingScoreService,
    private readonly tracker: ProgressTrackerService,
    private readonly stats: StatisticsService,
    private readonly dashboards: DashboardService,
  ) {}

  @Post('speaking/baseline')
  async runBaseline(@Req() req: any) {
    return this.speakingScore.calculateSpeakingScore(req.user.sub, 'baseline');
  }

  @Post('speaking/day7')
  async runDay7(@Req() req: any) {
    return this.speakingScore.calculateSpeakingScore(req.user.sub, 'day7');
  }

  @Post('speaking/day30')
  async runDay30(@Req() req: any) {
    return this.speakingScore.calculateSpeakingScore(req.user.sub, 'day30');
  }

  @Get('speaking/improvement')
  async getImprovement(@Req() req: any) {
    return this.speakingScore.getImprovement(req.user.sub);
  }

  @Get('speaking/trend')
  async getTrend(@Req() req: any) {
    return this.speakingScore.getTrend(req.user.sub);
  }

  @Get('progress')
  async getProgress(@Req() req: any) {
    return this.tracker.generateUserReport(req.user.sub);
  }

  @Get('aggregate')
  async getAggregate() {
    return this.tracker.getAggregateReport();
  }

  @Get('stats/cohort')
  async getCohortStats(@Query('cohort') cohort: string) {
    return this.stats.getCohortRetention(cohort || new Date().toISOString().slice(0, 10));
  }

  @Get('stats/improvement/:type')
  async getAggregateImprovement(@Param('type') type: 'speaking_day7' | 'speaking_day30') {
    return this.stats.getAggregateImprovement(type);
  }

  @Get('dashboard/improvement')
  async getUserImprovement(@Req() req: any) {
    return this.dashboards.getUserImprovement(req.user.sub);
  }

  @Get('dashboard/retention')
  async getRetention() {
    return this.dashboards.getRetention();
  }

  @Get('dashboard/conversation-quality')
  async getConversationQuality() {
    return this.dashboards.getConversationQuality();
  }

  @Get('dashboard/correction-accuracy')
  async getCorrectionAccuracy() {
    return this.dashboards.getAiCorrectionAccuracy();
  }
}
