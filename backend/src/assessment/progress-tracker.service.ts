import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';
import { SpeakingScoreService, ScoreTrend, SpeakingScore } from './speaking-score.service';
import { StatisticsService } from './statistics.service';

export interface UserProgressReport {
  userId: string;
  daysSinceRegistration: number;
  assessments: {
    baseline: SpeakingScore | null;
    day7: SpeakingScore | null;
    day30: SpeakingScore | null;
  };
  trends: {
    pronunciation: ScoreTrend;
    fluency: ScoreTrend;
    vocabulary: ScoreTrend;
    grammar: ScoreTrend;
    conversation: ScoreTrend;
  };
  milestones: {
    lessonsCompleted: number;
    conversationsHad: number;
    vocabularyLearned: number;
    pronunciationAssessments: number;
  };
  earlyWarningFlags: EarlyWarningFlag[];
}

export interface EarlyWarningFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metric: number;
  threshold: number;
}

const WARNING_THRESHOLDS = {
  minPronunciationSessions: 2,
  minConversations: 3,
  minLessonsPerWeek: 3,
  maxErrorRate: 0.3,
  minVocabGrowthPerWeek: 3,
  maxDaysWithoutActivity: 3,
};

@Injectable()
export class ProgressTrackerService {
  private readonly logger = new Logger(ProgressTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly speakingScore: SpeakingScoreService,
    private readonly stats: StatisticsService,
  ) {}

  async generateUserReport(userId: string): Promise<UserProgressReport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        assessments: {
          where: {
            type: {
              in: ['speaking_baseline', 'speaking_day7', 'speaking_day30'],
            },
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const daysSinceRegistration = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const [pronTrend, fluTrend, vocTrend, graTrend, convTrend, milestones, warnings] =
      await Promise.all([
        this.getDimensionTrend(userId, 'pronunciationAccuracy'),
        this.getDimensionTrend(userId, 'fluency'),
        this.getDimensionTrend(userId, 'vocabularyRichness'),
        this.getDimensionTrend(userId, 'grammarAccuracy'),
        this.getDimensionTrend(userId, 'conversationCompetence'),
        this.getMilestones(userId),
        this.checkWarnings(userId),
      ]);

    const baseline = user.assessments.find((a) => a.type === 'speaking_baseline');
    const day7 = user.assessments.find((a) => a.type === 'speaking_day7');
    const day30 = user.assessments.find((a) => a.type === 'speaking_day30');

    return {
      userId,
      daysSinceRegistration,
      assessments: {
        baseline: baseline?.content as unknown as SpeakingScore | null,
        day7: day7?.content as unknown as SpeakingScore | null,
        day30: day30?.content as unknown as SpeakingScore | null,
      },
      trends: {
        pronunciation: pronTrend,
        fluency: fluTrend,
        vocabulary: vocTrend,
        grammar: graTrend,
        conversation: convTrend,
      },
      milestones,
      earlyWarningFlags: warnings,
    };
  }

  @OnEvent('assessment.milestone.due')
  async handleMilestoneDue(payload: { userId: string; type: 'day7' | 'day30' }) {
    this.logger.log(`Running ${payload.type} assessment for user ${payload.userId}`);
    await this.speakingScore.calculateSpeakingScore(
      payload.userId,
      payload.type,
    );
  }

  async getAggregateReport(): Promise<{
    totalUsers: number;
    assessedUsers: number;
    meanBaseline: number;
    meanDay7: number;
    meanDay30: number;
    day7Improvement: { mean: number; cohensD: number; significant: boolean };
    day30Improvement: { mean: number; cohensD: number; significant: boolean };
    percentCompletingDay7: number;
    percentCompletingDay30: number;
  }> {
    const totalUsers = await this.prisma.user.count({ where: { isActive: true } });
    const baselineAssessments = await this.prisma.assessment.findMany({
      where: { type: 'speaking_baseline', status: 'completed' },
      select: { overallScore: true },
    });
    const day7Assessments = await this.prisma.assessment.findMany({
      where: { type: 'speaking_day7', status: 'completed' },
      select: { overallScore: true },
    });
    const day30Assessments = await this.prisma.assessment.findMany({
      where: { type: 'speaking_day30', status: 'completed' },
      select: { overallScore: true },
    });

    const bsScores = baselineAssessments.map((a) => Number(a.overallScore)).filter((s) => s > 0);
    const d7Scores = day7Assessments.map((a) => Number(a.overallScore)).filter((s) => s > 0);
    const d30Scores = day30Assessments.map((a) => Number(a.overallScore)).filter((s) => s > 0);

    const meanBaseline = bsScores.length > 0 ? bsScores.reduce((a, b) => a + b, 0) / bsScores.length : 0;
    const meanDay7 = d7Scores.length > 0 ? d7Scores.reduce((a, b) => a + b, 0) / d7Scores.length : 0;
    const meanDay30 = d30Scores.length > 0 ? d30Scores.reduce((a, b) => a + b, 0) / d30Scores.length : 0;

    const usersWithBaseline = new Set(baselineAssessments.map(() => true)).size;
    const assessedUsers = Math.min(bsScores.length, totalUsers);

    let day7Result = { mean: 0, cohensD: 0, significant: false };
    let day30Result = { mean: 0, cohensD: 0, significant: false };

    try {
      const d7 = await this.stats.getAggregateImprovement('speaking_day7');
      day7Result = { mean: d7.meanImprovement, cohensD: d7.cohensD, significant: d7.significant };
    } catch {}
    try {
      const d30 = await this.stats.getAggregateImprovement('speaking_day30');
      day30Result = { mean: d30.meanImprovement, cohensD: d30.cohensD, significant: d30.significant };
    } catch {}

    return {
      totalUsers,
      assessedUsers,
      meanBaseline: Math.round(meanBaseline),
      meanDay7: Math.round(meanDay7),
      meanDay30: Math.round(meanDay30),
      day7Improvement: day7Result,
      day30Improvement: day30Result,
      percentCompletingDay7:
        assessedUsers > 0 ? Math.round((d7Scores.length / assessedUsers) * 100) : 0,
      percentCompletingDay30:
        assessedUsers > 0 ? Math.round((d30Scores.length / assessedUsers) * 100) : 0,
    };
  }

  private async getDimensionTrend(
    userId: string,
    dimension: string,
  ): Promise<ScoreTrend> {
    return this.speakingScore.getTrend(userId);
  }

  private async getMilestones(userId: string) {
    const [lessonsCompleted, conversationsHad, vocabularyLearned, pronunciationAssessments] =
      await Promise.all([
        this.prisma.lessonsProgress.count({
          where: { userId: userId, status: 'completed' },
        }),
        this.prisma.conversationSession.count({
          where: { userId: userId, status: 'completed' },
        }),
        this.prisma.userVocabulary.count({ where: { userId: userId } }),
        this.prisma.speechSession.count({ where: { userId: userId } }),
      ]);

    return {
      lessonsCompleted,
      conversationsHad,
      vocabularyLearned,
      pronunciationAssessments,
    };
  }

  private async checkWarnings(userId: string): Promise<EarlyWarningFlag[]> {
    const warnings: EarlyWarningFlag[] = [];

    const speechSessions = await this.prisma.speechSession.count({
      where: { userId: userId },
    });
    if (speechSessions < WARNING_THRESHOLDS.minPronunciationSessions) {
      warnings.push({
        type: 'low_pronunciation_data',
        severity: 'medium',
        message: 'Not enough pronunciation samples for reliable scoring',
        metric: speechSessions,
        threshold: WARNING_THRESHOLDS.minPronunciationSessions,
      });
    }

    const conversations = await this.prisma.conversationSession.count({
      where: { userId: userId, status: 'completed' },
    });
    if (conversations < WARNING_THRESHOLDS.minConversations) {
      warnings.push({
        type: 'low_conversation_data',
        severity: 'medium',
        message: 'Not enough conversation practice for reliable assessment',
        metric: conversations,
        threshold: WARNING_THRESHOLDS.minConversations,
      });
    }

    const recentActivity = await this.prisma.dailyActivity.findFirst({
      where: { userId: userId },
      orderBy: { date: 'desc' },
    });
    if (recentActivity) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(recentActivity.date).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceActivity > WARNING_THRESHOLDS.maxDaysWithoutActivity) {
        warnings.push({
          type: 'inactivity',
          severity: 'high',
          message: `No activity for ${daysSinceActivity} days`,
          metric: daysSinceActivity,
          threshold: WARNING_THRESHOLDS.maxDaysWithoutActivity,
        });
      }
    }

    return warnings;
  }
}
