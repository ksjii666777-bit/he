import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ExerciseResult {
  exerciseId: number;
  type: string;
  correct: boolean;
  userAnswer: string;
  score: number;
}

@Injectable()
export class ExerciseEngineService {
  private readonly logger = new Logger(ExerciseEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkAnswer(
    lessonId: string,
    exerciseId: number,
    userAnswer: string,
  ): Promise<{
    correct: boolean;
    correctAnswer: string | string[];
    explanation: string;
    score: number;
  }> {
    const lesson = await this.prisma.lessonsProgress.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new Error('Lesson not found');

    const content = lesson.content as any;
    if (typeof content === 'string') {
      return {
        correct: false,
        correctAnswer: '',
        explanation: 'Lesson content not available',
        score: 0,
      };
    }

    const exercise = content.exercises?.find(
      (e: any) => e.id === exerciseId,
    );
    if (!exercise) throw new Error(`Exercise ${exerciseId} not found`);

    const result = this.evaluate(exercise, userAnswer);

    return result;
  }

  async submitBatch(
    userId: string,
    lessonId: string,
    answers: { exerciseId: number; userAnswer: string }[],
  ): Promise<{
    results: ExerciseResult[];
    totalScore: number;
    totalCorrect: number;
  }> {
    const results: ExerciseResult[] = [];
    let totalCorrect = 0;

    for (const answer of answers) {
      const result = await this.checkAnswer(
        lessonId,
        answer.exerciseId,
        answer.userAnswer,
      );
      const exerciseResult: ExerciseResult = {
        exerciseId: answer.exerciseId,
        type: '',
        correct: result.correct,
        userAnswer: answer.userAnswer,
        score: result.score,
      };
      if (result.correct) totalCorrect++;
      results.push(exerciseResult);
    }

    const totalScore =
      results.length > 0
        ? Math.round(
            (results.reduce((s, r) => s + r.score, 0) / results.length),
          )
        : 0;

    await this.prisma.lessonsProgress.update({
      where: { id: lessonId },
      data: {
        status: 'completed',
        score: totalScore,
        completedAt: new Date(),
      },
    });

    this.eventEmitter.emit('lesson.completed', {
      lessonId,
      userId,
      score: totalScore,
      totalCorrect,
      totalQuestions: answers.length,
    });

    return { results, totalScore, totalCorrect };
  }

  private evaluate(
    exercise: any,
    userAnswer: string,
  ): {
    correct: boolean;
    correctAnswer: string | string[];
    explanation: string;
    score: number;
  } {
    const answer = userAnswer.toLowerCase().trim();

    switch (exercise.type) {
      case 'listening':
      case 'vocabulary':
      case 'grammar': {
        const correctIdx = exercise.correctIndex;
        const correctText = exercise.options?.[correctIdx] || '';
        const userIdx = parseInt(answer);
        const isCorrect =
          userIdx === correctIdx ||
          answer === correctText.toLowerCase();
        return {
          correct: isCorrect,
          correctAnswer: correctText,
          explanation: isCorrect
            ? 'Correct!'
            : `The correct answer is: ${correctText}`,
          score: isCorrect ? 100 : 0,
        };
      }

      case 'pronunciation': {
        return {
          correct: true,
          correctAnswer: exercise.referenceText || '',
          explanation: 'Pronunciation will be evaluated by speech analysis',
          score: 0,
        };
      }

      case 'conversation': {
        return {
          correct: true,
          correctAnswer: '',
          explanation: 'Conversation responses are evaluated during practice',
          score: 0,
        };
      }

      default:
        return {
          correct: false,
          correctAnswer: 'Unknown exercise type',
          explanation: 'Could not evaluate this exercise type',
          score: 0,
        };
    }
  }
}
