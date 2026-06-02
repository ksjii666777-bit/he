import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PronunciationService } from '../speech/pronunciation.service';
import { DeepgramSttService } from '../speech/deepgram-stt.service';

export interface SpeakingScore {
  overall: number;
  confidence95: [number, number];
  dimensions: {
    pronunciationAccuracy: { score: number; weight: number };
    fluency: { score: number; weight: number };
    vocabularyRichness: { score: number; weight: number };
    grammarAccuracy: { score: number; weight: number };
    conversationCompetence: { score: number; weight: number };
  };
  metadata: {
    userId: string;
    assessedAt: Date;
    assessmentType: 'baseline' | 'day7' | 'day30';
    sampleSize: number;
  };
}

export interface ScoreTrend {
  direction: 'improving' | 'declining' | 'stable';
  slope: number;
  rSquared: number;
  pValue: number;
  significant: boolean;
}

const DIMENSION_WEIGHTS = {
  pronunciationAccuracy: 0.30,
  fluency: 0.25,
  vocabularyRichness: 0.15,
  grammarAccuracy: 0.15,
  conversationCompetence: 0.15,
};

@Injectable()
export class SpeakingScoreService {
  private readonly logger = new Logger(SpeakingScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pronunciation: PronunciationService,
    private readonly stt: DeepgramSttService,
  ) {}

  async calculateSpeakingScore(
    userId: string,
    assessmentType: 'baseline' | 'day7' | 'day30',
  ): Promise<SpeakingScore> {
    const [pronunciationScore, vocabStats, errorStats, conversationStats] =
      await Promise.all([
        this.getPronunciationAccuracy(userId),
        this.getVocabularyRichness(userId),
        this.getGrammarAccuracy(userId),
        this.getConversationCompetence(userId),
      ]);

    const dimensions = {
      pronunciationAccuracy: {
        score: pronunciationScore,
        weight: DIMENSION_WEIGHTS.pronunciationAccuracy,
      },
      fluency: {
        score: await this.getFluencyScore(userId),
        weight: DIMENSION_WEIGHTS.fluency,
      },
      vocabularyRichness: {
        score: vocabStats,
        weight: DIMENSION_WEIGHTS.vocabularyRichness,
      },
      grammarAccuracy: {
        score: errorStats,
        weight: DIMENSION_WEIGHTS.grammarAccuracy,
      },
      conversationCompetence: {
        score: conversationStats,
        weight: DIMENSION_WEIGHTS.conversationCompetence,
      },
    };

    const overall = this.computeWeightedScore(dimensions);
    const sem = 5.0;
    const ci95 = 1.96 * sem;

    const score: SpeakingScore = {
      overall: Math.round(overall),
      confidence95: [
        Math.max(0, Math.round(overall - ci95)),
        Math.min(100, Math.round(overall + ci95)),
      ],
      dimensions: Object.entries(dimensions).reduce(
        (acc, [key, val]) => ({
          ...acc,
          [key]: { score: Math.round(val.score), weight: val.weight },
        }),
        {} as SpeakingScore['dimensions'],
      ),
      metadata: {
        userId,
        assessedAt: new Date(),
        assessmentType,
        sampleSize: await this.getSampleSize(userId),
      },
    };

    await this.persistAssessment(userId, score);

    return score;
  }

  async getImprovement(
    userId: string,
  ): Promise<{
    baseline: SpeakingScore | null;
    current: SpeakingScore | null;
    improvement: number;
    dimensions: Record<string, number>;
    reliableChange: boolean;
  }> {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        userId: userId,
        type: { in: ['speaking_baseline', 'speaking_day7', 'speaking_day30'] },
      },
      orderBy: { startedAt: 'asc' },
    });

    const baseline = assessments.find((a) => a.type === 'speaking_baseline');
    const latest = assessments[assessments.length - 1];

    if (!baseline || !latest) {
      return {
        baseline: null,
        current: null,
        improvement: 0,
        dimensions: {},
        reliableChange: false,
      };
    }

    const baselineScore = baseline.overallScore
      ? Number(baseline.overallScore)
      : 0;
    const latestScore = latest.overallScore
      ? Number(latest.overallScore)
      : 0;
    const improvement = latestScore - baselineScore;
    const rci = improvement / 5.0;

    return {
      baseline: baselineScore as any,
      current: latestScore as any,
      improvement: Math.round(improvement),
      dimensions: this.extractDimensionChanges(baseline, latest),
      reliableChange: Math.abs(rci) > 1.96,
    };
  }

  async getTrend(userId: string): Promise<ScoreTrend> {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        userId: userId,
        type: { in: ['speaking_baseline', 'speaking_day7', 'speaking_day30'] },
      },
      orderBy: { startedAt: 'asc' },
    });

    if (assessments.length < 2) {
      return {
        direction: 'stable',
        slope: 0,
        rSquared: 0,
        pValue: 1,
        significant: false,
      };
    }

    const points = assessments.map((a, i) => ({
      x: i,
      y: a.overallScore ? Number(a.overallScore) : 0,
    }));

    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const ssRes = points.reduce(
      (s, p) => s + Math.pow(p.y - (intercept + slope * p.x), 2),
      0,
    );
    const ssTot = points.reduce(
      (s, p) => s + Math.pow(p.y - sumY / n, 2),
      0,
    );
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const se = Math.sqrt(ssRes / (n - 2)) / Math.sqrt(sumX2 - (sumX * sumX) / n);
    const tStat = slope / se;
    const dof = n - 2;
    const pValue = this.twoTailedPValue(tStat, dof);

    return {
      direction: slope > 1 ? 'improving' : slope < -1 ? 'declining' : 'stable',
      slope: Math.round(slope * 100) / 100,
      rSquared: Math.round(rSquared * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      significant: pValue < 0.05,
    };
  }

  private computeWeightedScore(dimensions: Record<string, { score: number; weight: number }>): number {
    return Object.values(dimensions).reduce(
      (sum, d) => sum + d.score * d.weight,
      0,
    );
  }

  private async getPronunciationAccuracy(userId: string): Promise<number> {
    const sessions = await this.prisma.speechSession.findMany({
      where: { userId: userId, sessionType: 'assessment' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { pronunciationAnalysis: true },
    });

    if (sessions.length === 0) return 50;
    const scores = sessions
      .map((s) => (s.pronunciationAnalysis?.overallScore ? Number(s.pronunciationAnalysis.overallScore) : null))
      .filter((s): s is number => s !== null);
    if (scores.length === 0) return 50;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private async getFluencyScore(userId: string): Promise<number> {
    const sessions = await this.prisma.speechSession.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { pronunciationAnalysis: true },
    });

    if (sessions.length === 0) return 50;
    const fluencyScores = sessions
      .map((s) => (s.pronunciationAnalysis?.fluencyScore ? Number(s.pronunciationAnalysis.fluencyScore) : null))
      .filter((s): s is number => s !== null);
    if (fluencyScores.length === 0) return 50;
    return fluencyScores.reduce((a, b) => a + b, 0) / fluencyScores.length;
  }

  private async getVocabularyRichness(userId: string): Promise<number> {
    const vocab = await this.prisma.userVocabulary.findMany({
      where: { userId: userId },
    });

    if (vocab.length === 0) return 30;

    const mastered = vocab.filter((v) => v.status === 'mastered').length;
    const learning = vocab.filter((v) => v.status === 'learning').length;
    const total = vocab.length;

    const masteredRatio = total > 0 ? mastered / total : 0;
    const baseScore = Math.min(100, total * 3);
    const masteryBonus = masteredRatio * 40;
    return Math.min(100, baseScore + masteryBonus);
  }

  private async getGrammarAccuracy(userId: string): Promise<number> {
    const errors = await this.prisma.errorCorrection.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (errors.length === 0) return 70;

    const recentErrors = errors.filter(
      (e) =>
        e.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const errorRate = 50 + Math.max(0, 50 - recentErrors.length * 2);
    return Math.min(100, errorRate);
  }

  private async getConversationCompetence(userId: string): Promise<number> {
    const conversations = await this.prisma.conversationSession.findMany({
      where: { userId: userId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (conversations.length === 0) return 40;

    const avgScore = conversations
      .map((c) => (c.avgScore ? Number(c.avgScore) : 0))
      .filter((s) => s > 0);

    if (avgScore.length === 0) return 40;
    return avgScore.reduce((a, b) => a + b, 0) / avgScore.length;
  }

  private async getSampleSize(userId: string): Promise<number> {
    const [speechCount, lessonCount, conversationCount] = await Promise.all([
      this.prisma.speechSession.count({ where: { userId: userId } }),
      this.prisma.lessonsProgress.count({ where: { userId: userId } }),
      this.prisma.conversationSession.count({ where: { userId: userId } }),
    ]);
    return speechCount + lessonCount + conversationCount;
  }

  private async persistAssessment(
    userId: string,
    score: SpeakingScore,
  ): Promise<void> {
    await this.prisma.assessment.create({
      data: {
        userId: userId,
        languageCode: 'en',
        type: `speaking_${score.metadata.assessmentType}`,
        status: 'completed',
        overallScore: score.overall,
        overallCefr: this.scoreToCefr(score.overall),
        content: score as any,
        completedAt: new Date(),
        durationSec: 0,
      },
    });
  }

  private scoreToCefr(score: number): string {
    if (score >= 80) return 'B1';
    if (score >= 60) return 'A2';
    if (score >= 40) return 'A1';
    return 'A0';
  }

  private extractDimensionChanges(
    baseline: any,
    latest: any,
  ): Record<string, number> {
    const dims = [
      'pronunciationAccuracy',
      'fluency',
      'vocabularyRichness',
      'grammarAccuracy',
      'conversationCompetence',
    ];
    const changes: Record<string, number> = {};
    for (const dim of dims) {
      const base = baseline.content?.[dim]?.score || 0;
      const current = latest.content?.[dim]?.score || 0;
      changes[dim] = Math.round(current - base);
    }
    return changes;
  }

  private twoTailedPValue(t: number, dof: number): number {
    const x = dof / (dof + t * t);
    let p = 1;
    if (dof % 2 === 0) {
      for (let k = 1; k <= dof / 2 - 1; k++) {
        p += (x * (dof / 2 - k)) / k;
      }
      p = 1 - 0.5 * Math.pow(1 - x, dof / 2) * p;
    } else {
      p = 1 - (1 / Math.PI) * (Math.atan(t / Math.sqrt(dof)) + (Math.sqrt(x) / Math.PI) * p);
    }
    return Math.max(0, Math.min(1, 2 * (1 - p)));
  }
}
