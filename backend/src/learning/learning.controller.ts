import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { LessonGeneratorService } from './lesson-generator.service';
import { ExerciseEngineService } from './exercise-engine.service';
import { PlacementTestService } from './placement-test.service';
import { RoadmapEnhancerService } from './roadmap-enhancer.service';

@Controller('learning')
export class LearningController {
  constructor(
    private readonly lessonGen: LessonGeneratorService,
    private readonly exerciseEngine: ExerciseEngineService,
    private readonly placementTest: PlacementTestService,
    private readonly roadmapEnhancer: RoadmapEnhancerService,
  ) {}

  @Post('lesson/generate')
  async generateLesson(@Req() req: any) {
    const lesson = await this.lessonGen.generateDailyLesson(req.user.sub);
    return lesson;
  }

  @Post('lesson/:id/complete')
  async completeLesson(
    @Req() req: any,
    @Param('id') lessonId: string,
    @Body() body: { score: number; answers: any[] },
  ) {
    return this.lessonGen.completeLesson(
      req.user.sub,
      lessonId,
      body.score,
      body.answers,
    );
  }

  @Post('lesson/:id/check')
  async checkAnswer(
    @Param('id') lessonId: string,
    @Body() body: { exerciseId: number; userAnswer: string },
  ) {
    return this.exerciseEngine.checkAnswer(
      lessonId,
      body.exerciseId,
      body.userAnswer,
    );
  }

  @Post('lesson/:id/submit')
  async submitLesson(
    @Req() req: any,
    @Param('id') lessonId: string,
    @Body() body: { answers: { exerciseId: number; userAnswer: string }[] },
  ) {
    return this.exerciseEngine.submitBatch(
      req.user.sub,
      lessonId,
      body.answers,
    );
  }

  @Get('placement/generate')
  async getPlacementTest() {
    return this.placementTest.generateTest();
  }

  @Post('placement/evaluate')
  async evaluatePlacement(
    @Req() req: any,
    @Body()
    body: { answers: { questionId: number; selectedIndex: number }[] },
  ) {
    return this.placementTest.evaluateTest(req.user.sub, body.answers);
  }

  @Post('roadmap/:id/enhance')
  async enhanceRoadmap(@Param('id') roadmapId: string) {
    return this.roadmapEnhancer.enhanceRoadmap(roadmapId);
  }
}
