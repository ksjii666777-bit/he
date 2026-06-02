import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { LearningController } from './learning.controller';
import { LessonGeneratorService } from './lesson-generator.service';
import { ExerciseEngineService } from './exercise-engine.service';
import { PlacementTestService } from './placement-test.service';
import { RoadmapEnhancerService } from './roadmap-enhancer.service';

@Module({
  imports: [AiGatewayModule],
  controllers: [LearningController],
  providers: [
    LessonGeneratorService,
    ExerciseEngineService,
    PlacementTestService,
    RoadmapEnhancerService,
  ],
  exports: [LessonGeneratorService],
})
export class LearningModule {}
