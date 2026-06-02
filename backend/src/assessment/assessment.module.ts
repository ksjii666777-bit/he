import { Module } from '@nestjs/common';
import { AssessmentController } from './assessment.controller';
import { SpeakingScoreService } from './speaking-score.service';
import { StatisticsService } from './statistics.service';
import { ProgressTrackerService } from './progress-tracker.service';
import { DashboardService } from './dashboard.service';
import { SpeechModule } from '../speech/speech.module';

@Module({
  imports: [SpeechModule],
  controllers: [AssessmentController],
  providers: [
    SpeakingScoreService,
    StatisticsService,
    ProgressTrackerService,
    DashboardService,
  ],
  exports: [SpeakingScoreService, StatisticsService, ProgressTrackerService],
})
export class AssessmentModule {}
