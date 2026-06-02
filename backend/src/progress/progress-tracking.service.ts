import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProgressTrackingService {
  private readonly logger = new Logger(ProgressTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserProgress(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        lessonsProgress: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 30,
        },
        userVocabulary: {
          orderBy: { nextReviewAt: 'desc' },
          take: 100,
        },
        errorCorrections: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        roadmap: {
          include: { milestones: true },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const totalLessons = await this.prisma.lessonsProgress.count({
      where: { userId, status: 'completed' },
    });
    const avgScore = await this.getAverageScore(userId);

    const cefrMilestones = this.computeCefrProgress(user);
    const streak = await this.computeStreak(userId);
    const recentActivity = await this.getRecentActivity(userId);

    return {
      currentLevel: 'A0',
      totalLessons,
      averageScore: avgScore,
      streak,
      vocabularyLearned: user.userVocabulary?.length || 0,
      cefrProgress: cefrMilestones,
      recentActivity,
      currentRoadmap: user.roadmap || null,
    };
  }

  @OnEvent('lesson.completed')
  async handleLessonCompleted(payload: {
    lessonId: string;
    userId: string;
    score: number;
    cefrLevel?: string;
  }) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      await this.prisma.dailyActivity.upsert({
        where: { userId_date: { userId: payload.userId, date: today } },
        update: {
          lessonsCompleted: { increment: 1 },
        },
        create: {
          userId: payload.userId,
          date: today,
          lessonsCompleted: 1,
        },
      });

      await this.prisma.lessonsProgress.upsert({
        where: { userId_lessonDate: { userId: payload.userId, lessonDate: new Date() } },
        update: {
          score: payload.score,
          completedAt: new Date(),
        },
        create: {
          userId: payload.userId,
          lessonDate: new Date(),
          title: 'Lesson',
          cefrLevel: payload.cefrLevel || 'A1',
          score: payload.score,
          completedAt: new Date(),
          status: 'completed',
        },
      });

      this.logger.log(
        `Progress updated for lesson ${payload.lessonId}: score ${payload.score}`,
      );
    } catch (err) {
      this.logger.error('Failed to handle lesson.completed', err);
    }
  }

  @OnEvent('conversation.ended')
  async handleConversationEnded(payload: {
    sessionId: string;
    userId: string;
    scenario: string;
    turnCount: number;
    overallScore: number;
  }) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      await this.prisma.dailyActivity.upsert({
        where: { userId_date: { userId: payload.userId, date: today } },
        update: {
          conversationsHad: { increment: payload.turnCount },
        },
        create: {
          userId: payload.userId,
          date: today,
          conversationsHad: payload.turnCount,
        },
      });

      this.logger.log(
        `Conversation progress updated for session ${payload.sessionId}`,
      );
    } catch (err) {
      this.logger.error('Failed to handle conversation.ended', err);
    }
  }

  @OnEvent('vocabulary.learned')
  async handleVocabularyLearned(payload: {
    userId: string;
    word: string;
    meaning: string;
    score: number;
  }) {
    try {
      await this.prisma.userVocabulary.upsert({
        where: {
          userId_vocabularyId: { userId: payload.userId, vocabularyId: '' },
        },
        update: {
          timesSeen: { increment: 1 },
        },
        create: {
          userId: payload.userId,
          vocabularyId: '',
        },
      });
    } catch (err) {
      this.logger.error('Failed to handle vocabulary.learned', err);
    }
  }

  private async getAverageScore(userId: string): Promise<number> {
    const result = await this.prisma.lessonsProgress.aggregate({
      where: { userId, status: 'completed', score: { not: null } },
      _avg: { score: true },
    });
    return result._avg.score ? Math.round(Number(result._avg.score)) : 0;
  }

  private async computeStreak(userId: string): Promise<number> {
    const activities = await this.prisma.dailyActivity.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 365,
      select: { date: true },
    });

    if (activities.length === 0) return 0;

    const activeDates = new Set(
      activities.map((a: any) =>
        typeof a.date === 'string'
          ? a.date.slice(0, 10)
          : new Date(a.date).toISOString().slice(0, 10),
      ),
    );

    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);

    if (!activeDates.has(today)) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (!activeDates.has(yesterdayStr)) return 0;
    }

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365);

    const checkDate = new Date(startDate);
    while (checkDate <= new Date(today)) {
      const key = checkDate.toISOString().slice(0, 10);
      if (activeDates.has(key)) {
        streak++;
      } else {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (dateStr < today) streak = 0;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }

    return streak;
  }

  private computeCefrProgress(user: any): any {
    const levelOrder = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const current = 'A0';
    const idx = levelOrder.indexOf(current);
    return {
      current,
      nextLevel: idx < levelOrder.length - 1 ? levelOrder[idx + 1] : null,
      progress: idx >= 0 ? Math.round((idx / (levelOrder.length - 1)) * 100) : 0,
    };
  }

  private async getRecentActivity(userId: string): Promise<any[]> {
    const lessons = await this.prisma.lessonsProgress.findMany({
      where: { userId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { title: true, score: true, completedAt: true },
    });

    return lessons.map((l) => ({
      type: 'lesson',
      title: l.title,
      score: l.score,
      date: l.completedAt,
    }));
  }
}
