import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';
import { OpenRouterService } from '../ai-gateway/openrouter/openrouter.service';
import { ContentValidator } from '../ai-gateway/validators/content-validator';
import { CostGuard } from '../ai-gateway/cost-guard';
import {
  buildLessonPrompt,
  LessonPromptInput,
} from '../ai-gateway/prompts/lesson.v1';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class LessonGeneratorService {
  private readonly logger = new Logger(LessonGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: OpenRouterService,
    private readonly validator: ContentValidator,
    private readonly costGuard: CostGuard,
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: RedisService,
  ) {}

  async generateDailyLesson(userId: string): Promise<any> {
    const cacheKey = `lesson:daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userVocabulary: {
          take: 50,
          orderBy: { nextReviewAt: 'desc' },
          include: { vocabulary: true },
        },
        errorCorrections: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) throw new Error('User not found');

    const canProceed = await this.costGuard.checkQuota(userId);
    if (!canProceed) throw new Error('Monthly quota exceeded');

    const weakAreas = this.identifyWeakAreas(profile);
    const knownVocab =
      profile.userVocabulary?.map((v) => v.vocabulary.word) || [];
    const recentErrors =
      profile.errorCorrections?.map((e) => e.incorrectText) || [];

    const input: LessonPromptInput = {
      name: profile.profile?.name || 'Student',
      age: profile.profile?.age || 25,
      nativeLanguage: profile.profile?.nativeLanguage || 'unknown',
      cefrLevel: 'A1',
      weakAreas,
      learningGoal: profile.profile?.learningGoal || 'general',
      vocabularyLearned: knownVocab,
      dailyStudyMin: profile.profile?.dailyStudyMin || 15,
    };

    const prompt = buildLessonPrompt(input);

    const response = await this.bedrock.generateLesson(prompt);

    let lesson: any;
    try {
      lesson = JSON.parse(response.content);
    } catch {
      throw new Error('Failed to parse lesson from AI response');
    }

    const validation = this.validator.validateLesson(lesson);
    if (!validation.passed) {
      if (lesson.exercises?.length >= 4) {
        lesson._validationWarning = 'Some exercises have issues';
      } else {
        throw new Error('Generated lesson failed validation');
      }
    }

    await this.costGuard.trackCost(userId, response.costCents || 0);

    const savedLesson = await this.prisma.lessonsProgress.create({
      data: {
        userId,
        title: lesson.title,
        content: lesson,
        cefrLevel: lesson.cefrLevel || 'A1',
        status: 'in_progress',
        lessonDate: new Date(),
        vocabularyLearned: knownVocab,
        weakAreas,
        score: null,
      },
    });

    await this.redis.set(cacheKey, JSON.stringify(savedLesson), 7200);

    this.eventEmitter.emit('lesson.generated', {
      lessonId: savedLesson.id,
      userId,
      title: lesson.title,
      cefrLevel: lesson.cefrLevel,
    });

    return savedLesson;
  }

  async completeLesson(
    userId: string,
    lessonId: string,
    score: number,
    answers: any[],
  ): Promise<any> {
    const lesson = await this.prisma.lessonsProgress.update({
      where: { id: lessonId },
      data: {
        status: 'completed',
        score,
        completedAt: new Date(),
      },
    });

    this.eventEmitter.emit('lesson.completed', {
      lessonId,
      userId,
      score,
      cefrLevel: lesson.cefrLevel,
    });

    return lesson;
  }

  private identifyWeakAreas(profile: any): string[] {
    const areas: string[] = [];
    const errors = profile.errorCorrections || [];
    const typeCount = new Map<string, number>();
    for (const e of errors) {
      typeCount.set(e.category, (typeCount.get(e.category) || 0) + 1);
    }
    const sorted = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [category] of sorted.slice(0, 3)) {
      areas.push(category);
    }
    if (areas.length === 0) areas.push('vocabulary', 'grammar');
    return areas;
  }
}
