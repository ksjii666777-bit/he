import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface UserImprovementDashboard {
  userId: string;
  speakingScoreHistory: { date: string; score: number; ci95: [number, number] }[];
  dimensionRadar: { dimension: string; baseline: number; current: number; target: number }[];
  trendDirection: string;
  daysActive: number;
  streak: number;
}

export interface RetentionDashboard {
  overallRetention: { day: number; percentage: number }[];
  cohortRetention: { cohort: string; day1: number; day7: number; day30: number }[];
  churnRate: number;
  averageSessionDays: number;
}

export interface ConversationQualityDashboard {
  totalConversations: number;
  totalTurns: number;
  averageScore: number;
  scoreTrend: number;
  scenarioCoverage: { scenario: string; count: number; avgScore: number }[];
  correctionsPerConversation: number;
  topErrors: { category: string; count: number }[];
}

export interface AiCorrectionAccuracyDashboard {
  totalCorrections: number;
  correctionsWithFeedback: number;
  averageCorrectionScore: number;
  categoryBreakdown: { category: string; count: number; percentage: number }[];
  helpfulnessRate: number;
  precision: number;
  recall: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserImprovement(userId: string): Promise<UserImprovementDashboard> {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        userId: userId,
        type: { in: ['speaking_baseline', 'speaking_day7', 'speaking_day30'] },
        status: 'completed',
      },
      orderBy: { startedAt: 'asc' },
    });

    const speakingScoreHistory = assessments.map((a: any) => ({
      date: a.startedAt.toISOString().slice(0, 10),
      score: a.overallScore ? Number(a.overallScore) : 0,
      ci95: [
        Math.max(0, (a.overallScore ? Number(a.overallScore) : 0) - 10),
        Math.min(100, (a.overallScore ? Number(a.overallScore) : 0) + 10),
      ] as [number, number],
    }));

    const dims = ['pronunciationAccuracy', 'fluency', 'vocabularyRichness', 'grammarAccuracy', 'conversationCompetence'];
    const baseline = assessments.find((a) => a.type === 'speaking_baseline');
    const latest = assessments[assessments.length - 1];
    const dimensionRadar = dims.map((dim) => ({
      dimension: dim.replace(/([A-Z])/g, ' $1').trim(),
      baseline: (baseline?.content as any)?.[dim]?.score || 0,
      current: (latest?.content as any)?.[dim]?.score || 0,
      target: 80,
    }));

    const daysActive = await this.prisma.dailyActivity.count({
      where: { userId: userId, lessonsCompleted: { gt: 0 } },
    });

    const latestActivity = await this.prisma.dailyActivity.findFirst({
      where: { userId: userId },
      orderBy: { date: 'desc' },
      select: { streakDay: true },
    });

    const trendDirection = assessments.length >= 2
      ? (Number(assessments[assessments.length - 1]?.overallScore) || 0) >
        (Number(assessments[0]?.overallScore) || 0)
        ? 'improving'
        : 'declining'
      : 'insufficient_data';

    return {
      userId,
      speakingScoreHistory,
      dimensionRadar,
      trendDirection,
      daysActive,
      streak: latestActivity?.streakDay || 0,
    };
  }

  async getRetention(): Promise<RetentionDashboard> {
    const cohorts = await this.prisma.$queryRaw<any[]>`
      WITH weekly_cohorts AS (
        SELECT
          date_trunc('week', created_at) as cohort_week,
          id as user_id
        FROM users
        WHERE created_at >= NOW() - INTERVAL '90 days'
      ),
      activity AS (
        SELECT
          wc.cohort_week,
          wc.user_id,
          da.date,
          da.date - wc.cohort_week::date as days_since_signup
        FROM weekly_cohorts wc
        LEFT JOIN daily_activity da ON da.user_id = wc.user_id
      )
      SELECT
        cohort_week::date as cohort,
        COUNT(DISTINCT user_id) FILTER (WHERE days_since_signup = 1)::float /
          NULLIF(COUNT(DISTINCT user_id), 0) * 100 as day1,
        COUNT(DISTINCT user_id) FILTER (WHERE days_since_signup = 7)::float /
          NULLIF(COUNT(DISTINCT user_id), 0) * 100 as day7,
        COUNT(DISTINCT user_id) FILTER (WHERE days_since_signup = 30)::float /
          NULLIF(COUNT(DISTINCT user_id), 0) * 100 as day30
      FROM activity
      GROUP BY cohort_week
      ORDER BY cohort_week
    `;

    const cohortRetention = cohorts.map((c: any) => ({
      cohort: c.cohort?.toISOString?.()?.slice(0, 10) || c.cohort,
      day1: Math.round(Number(c.day1 || 0)),
      day7: Math.round(Number(c.day7 || 0)),
      day30: Math.round(Number(c.day30 || 0)),
    }));

    const overall = await this.prisma.$queryRaw<any[]>`
      SELECT
        AVG(da.lessons_completed > 0 OR da.conversation_turns > 0) as churn_rate
      FROM daily_activity da
      WHERE da.date >= CURRENT_DATE - 7
    `;

    return {
      overallRetention: [
        { day: 1, percentage: 0 },
        { day: 7, percentage: 0 },
        { day: 30, percentage: 0 },
      ],
      cohortRetention,
      churnRate: Math.round(Number(overall[0]?.churn_rate || 0) * 100),
      averageSessionDays: 0,
    };
  }

  async getConversationQuality(): Promise<ConversationQualityDashboard> {
    const conversations = await this.prisma.conversationSession.findMany({
      where: { status: 'completed' },
      select: { scenario: true, avgScore: true, messageCount: true },
    });

    const totalConversations = conversations.length;
    const totalTurns = conversations.reduce((s, c) => s + (c as any).messageCount, 0);
    const scores = conversations
      .map((c) => (c.avgScore ? Number(c.avgScore) : 0))
      .filter((s) => s > 0);
    const averageScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    const scenarioMap = new Map<string, { count: number; totalScore: number }>();
    for (const c of conversations) {
      const existing = scenarioMap.get(c.scenario) || { count: 0, totalScore: 0 };
      existing.count++;
      existing.totalScore += (c as any).avgScore ? Number((c as any).avgScore) : 0;
      scenarioMap.set(c.scenario, existing);
    }
    const scenarioCoverage = [...scenarioMap.entries()].map(([scenario, data]) => ({
      scenario,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count),
    }));

    const errorCategories = await this.prisma.$queryRaw<any[]>`
      SELECT category, COUNT(*) as count
      FROM error_corrections
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      totalConversations,
      totalTurns,
      averageScore: Math.round(averageScore),
      scoreTrend: 0,
      scenarioCoverage,
      correctionsPerConversation:
        totalConversations > 0
          ? Math.round((totalTurns / totalConversations) * 10) / 10
          : 0,
      topErrors: errorCategories.map((e: any) => ({
        category: e.category,
        count: Number(e.count),
      })),
    };
  }

  async getAiCorrectionAccuracy(): Promise<AiCorrectionAccuracyDashboard> {
    const corrections = await this.prisma.errorCorrection.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    });

    const categoryMap = new Map<string, number>();
    for (const c of corrections) {
      categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
    }
    const total = corrections.length;
    const categoryBreakdown = [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));

    const helpfulCorrections = corrections.filter((c) => c.explanation !== null).length;

    return {
      totalCorrections: total,
      correctionsWithFeedback: total,
      averageCorrectionScore: 0,
      categoryBreakdown,
      helpfulnessRate:
        total > 0 ? Math.round((helpfulCorrections / total) * 100) : 0,
      precision: 0,
      recall: 0,
    };
  }
}
