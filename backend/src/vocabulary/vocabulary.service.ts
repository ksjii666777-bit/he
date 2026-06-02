import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';
import { Sm5Result } from './sm-5.service';

@Injectable()
export class VocabularyService {
  private readonly logger = new Logger(VocabularyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getDueReviews(
    userId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const due = await this.prisma.userVocabulary.findMany({
      where: {
        userId,
        nextReviewAt: { lte: new Date() },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: limit,
    });
    return due;
  }

  async updateReview(
    userId: string,
    word: string,
    quality: number,
    sm5Result: Sm5Result,
  ): Promise<any> {
    const updated = await this.prisma.userVocabulary.update({
      where: {
        userId_vocabularyId: { userId, vocabularyId: word },
      },
      data: {
        familiarity: Math.round((quality / 5) * 10),
        intervalSec: BigInt(sm5Result.interval),
        easeFactor: sm5Result.easeFactor,
        nextReviewAt: new Date(sm5Result.nextReviewDate),
        timesSeen: { increment: 1 },
      },
    });
    return updated;
  }

  async getStats(userId: string): Promise<any> {
    const total = await this.prisma.userVocabulary.count({
      where: { userId },
    });
    const mastered = await this.prisma.userVocabulary.count({
      where: {
        userId,
        familiarity: { gte: 8 },
        intervalSec: { gte: BigInt(21) },
      },
    });
    const learning = await this.prisma.userVocabulary.count({
      where: {
        userId,
        familiarity: { lt: 8 },
        nextReviewAt: { lte: new Date() },
      },
    });
    const dueToday = await this.prisma.userVocabulary.count({
      where: {
        userId,
        nextReviewAt: { lte: new Date() },
      },
    });

    return {
      total,
      mastered,
      learning,
      dueToday,
      retentionRate: total > 0 ? Math.round((mastered / total) * 100) : 0,
    };
  }
}
