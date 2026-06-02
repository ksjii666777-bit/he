import { Controller, Get, Req } from '@nestjs/common';
import { ProgressTrackingService } from './progress-tracking.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressTrackingService) {}

  @Get()
  async getProgress(@Req() req: any) {
    return this.progress.getUserProgress(req.user.sub);
  }

  @Get('streak')
  async getStreak(@Req() req: any) {
    const progress = await this.progress.getUserProgress(req.user.sub);
    return { streak: progress.streak };
  }

  @Get('daily')
  async getDailyActivity(@Req() req: any) {
    const progress = await this.progress.getUserProgress(req.user.sub);
    return {
      lessonsCompleted: progress.recentActivity?.length || 0,
      averageScore: progress.averageScore,
      streak: progress.streak,
    };
  }
}
