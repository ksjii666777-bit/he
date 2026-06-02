import { Module } from '@nestjs/common';
import { ProgressTrackingService } from './progress-tracking.service';
import { ProgressController } from './progress.controller';

@Module({
  controllers: [ProgressController],
  providers: [ProgressTrackingService],
  exports: [ProgressTrackingService],
})
export class ProgressModule {}
