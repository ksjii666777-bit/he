import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface CohortStats {
  n: number;
  mean: number;
  median: number;
  stdDev: number;
  sem: number;
  ci95: [number, number];
  min: number;
  max: number;
}

export interface PairedTestResult {
  tStatistic: number;
  dof: number;
  pValue: number;
  cohensD: number;
  significant: boolean;
  meanDifference: number;
  ci95Difference: [number, number];
  interpretation: string;
}

export interface MdeResult {
  minimumDetectableEffect: number;
  requiredSampleSize: number;
  actualPower: number;
}

export interface ReliableChangeIndex {
  rci: number;
  reliable: boolean;
  interpretation: string;
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async computePairedTTest(
    preScores: number[],
    postScores: number[],
  ): Promise<PairedTestResult> {
    if (preScores.length !== postScores.length || preScores.length < 2) {
      throw new Error('Need equal and ≥2 paired observations');
    }

    const n = preScores.length;
    const differences = preScores.map((pre, i) => postScores[i] - pre);
    const meanDiff = differences.reduce((s, d) => s + d, 0) / n;

    const variance =
      differences.reduce((s, d) => s + Math.pow(d - meanDiff, 2), 0) /
      (n - 1);
    const stdDev = Math.sqrt(variance);
    const sem = stdDev / Math.sqrt(n);
    const tStatistic = sem > 0 ? meanDiff / sem : 0;
    const dof = n - 1;
    const pValue = this.tCdf(tStatistic, dof);
    const cohensD = stdDev > 0 ? meanDiff / stdDev : 0;

    const ci95 = 1.96 * sem;

    return {
      tStatistic: Math.round(tStatistic * 1000) / 1000,
      dof,
      pValue: Math.round(pValue * 10000) / 10000,
      cohensD: Math.round(cohensD * 100) / 100,
      significant: pValue < 0.05,
      meanDifference: Math.round(meanDiff * 100) / 100,
      ci95Difference: [
        Math.round((meanDiff - ci95) * 100) / 100,
        Math.round((meanDiff + ci95) * 100) / 100,
      ],
      interpretation: this.interpretPairedTest(pValue, cohensD, meanDiff),
    };
  }

  async computeCohortStats(scores: number[]): Promise<CohortStats> {
    const n = scores.length;
    if (n === 0) {
      return {
        n: 0, mean: 0, median: 0, stdDev: 0, sem: 0,
        ci95: [0, 0], min: 0, max: 0,
      };
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const median =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    const variance =
      sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const sem = stdDev / Math.sqrt(n);
    const ci95margin = 1.96 * sem;

    return {
      n,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      sem: Math.round(sem * 100) / 100,
      ci95: [
        Math.round((mean - ci95margin) * 100) / 100,
        Math.round((mean + ci95margin) * 100) / 100,
      ],
      min: sorted[0],
      max: sorted[n - 1],
    };
  }

  computeMinimumDetectableEffect(
    sampleSize: number,
    stdDev: number,
    alpha: number = 0.05,
    power: number = 0.8,
  ): MdeResult {
    const zAlpha = 1.96;
    const zBeta = 0.842;
    const mde =
      ((zAlpha + zBeta) * stdDev) / Math.sqrt(sampleSize);
    const requiredN = Math.pow((zAlpha + zBeta) * stdDev / 5, 2);
    const actualPower = this.computePower(mde, sampleSize, stdDev, alpha);

    return {
      minimumDetectableEffect: Math.round(mde * 100) / 100,
      requiredSampleSize: Math.ceil(requiredN),
      actualPower: Math.round(actualPower * 100) / 100,
    };
  }

  computeReliableChangeIndex(
    preScore: number,
    postScore: number,
    stdDev: number,
    reliability: number = 0.85,
  ): ReliableChangeIndex {
    const se = stdDev * Math.sqrt(1 - reliability);
    const sDiff = Math.sqrt(2 * Math.pow(se, 2));
    const rci = (postScore - preScore) / sDiff;
    const reliable = Math.abs(rci) > 1.96;

    return {
      rci: Math.round(rci * 100) / 100,
      reliable,
      interpretation: reliable
        ? `Change of ${Math.round(postScore - preScore)} points is statistically reliable`
        : `Change of ${Math.round(postScore - preScore)} points is within measurement error`,
    };
  }

  async getCohortRetention(cohortDate: string): Promise<{
    cohortDate: string;
    cohortSize: number;
    retention: { day: number; count: number; percentage: number }[];
  }> {
    const cohort = await this.prisma.$queryRaw<any[]>`
      WITH cohort_users AS (
        SELECT id, created_at::date as signup_date
          FROM users
         WHERE created_at::date = ${cohortDate}::date
      ),
      day_activity AS (
        SELECT da.user_id, da.date, da.lessons_completed > 0 or da.conversation_turns > 0 as was_active
          FROM daily_activity da
          JOIN cohort_users c ON da.user_id = c.id
      )
      SELECT
        d.day,
        COUNT(DISTINCT da.user_id) as active_users
      FROM (VALUES (1), (3), (7), (14), (21), (30)) AS d(day)
      LEFT JOIN day_activity da
        ON da.date = (SELECT signup_date FROM cohort_users LIMIT 1) + d.day
        AND da.was_active = true
      GROUP BY d.day
      ORDER BY d.day
    `;

    const cohortSize = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(cohortDate),
          lt: new Date(
            new Date(cohortDate).getTime() + 24 * 60 * 60 * 1000,
          ),
        },
      },
    });

    return {
      cohortDate,
      cohortSize,
      retention: cohort.map((r: any) => ({
        day: Number(r.day),
        count: Number(r.active_users || 0),
        percentage:
          cohortSize > 0
            ? Math.round((Number(r.active_users || 0) / cohortSize) * 100)
            : 0,
      })),
    };
  }

  async getAggregateImprovement(
    assessmentType: 'speaking_day7' | 'speaking_day30',
  ): Promise<{
    n: number;
    meanImprovement: number;
    stdDev: number;
    cohensD: number;
    significant: boolean;
    pValue: number;
    percentImproved: number;
  }> {
    const followups = await this.prisma.assessment.findMany({
      where: { type: assessmentType, status: 'completed' },
      include: {
        user: {
          include: {
            assessments: {
              where: { type: 'speaking_baseline', status: 'completed' },
              take: 1,
            },
          },
        },
      },
    });

    const pairs = followups
      .map((f) => ({
        post: f.overallScore ? Number(f.overallScore) : null,
        pre: f.user.assessments[0]?.overallScore
          ? Number(f.user.assessments[0].overallScore)
          : null,
      }))
      .filter((p): p is { pre: number; post: number } => p.pre !== null && p.post !== null);

    if (pairs.length < 2) {
      return {
        n: pairs.length,
        meanImprovement: 0,
        stdDev: 0,
        cohensD: 0,
        significant: false,
        pValue: 1,
        percentImproved: 0,
      };
    }

    const preScores = pairs.map((p) => p.pre);
    const postScores = pairs.map((p) => p.post);
    const testResult = await this.computePairedTTest(preScores, postScores);
    const percentImproved = Math.round(
      (pairs.filter((p) => p.post > p.pre).length / pairs.length) * 100,
    );

    return {
      n: pairs.length,
      meanImprovement: testResult.meanDifference,
      stdDev: testResult.cohensD * testResult.meanDifference / Math.abs(testResult.meanDifference || 1),
      cohensD: testResult.cohensD,
      significant: testResult.significant,
      pValue: testResult.pValue,
      percentImproved,
    };
  }

  private computePower(
    effectSize: number,
    n: number,
    stdDev: number,
    alpha: number,
  ): number {
    const zAlpha = 1.96;
    const se = stdDev / Math.sqrt(n);
    const t = effectSize / se;
    const zBeta = t - zAlpha;
    return 0.5 * (1 + this.erf(zBeta / Math.sqrt(2)));
  }

  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y =
      1 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  private tCdf(t: number, dof: number): number {
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

  private interpretPairedTest(
    pValue: number,
    cohensD: number,
    meanDiff: number,
  ): string {
    if (pValue >= 0.05) return 'No statistically significant change detected';
    const direction = meanDiff > 0 ? 'improvement' : 'decline';
    const magnitude =
      cohensD >= 0.8
        ? 'large'
        : cohensD >= 0.5
          ? 'moderate'
          : cohensD >= 0.2
            ? 'small'
            : 'negligible';
    const absDiff = Math.abs(meanDiff);
    return `Statistically significant ${direction} (p=${pValue}, d=${cohensD}). ` +
      `${magnitude} effect: ${absDiff} point ${direction}.`;
  }
}
