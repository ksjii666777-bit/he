import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

interface MetricPoint {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private buffer: MetricPoint[] = [];

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    setInterval(() => this.flush(), 60000);
  }

  record(name: string, value: number, labels?: Record<string, string>): void {
    this.buffer.push({ name, value, labels, timestamp: new Date() });
  }

  async getDau(days: number = 7): Promise<{ date: string; count: number }[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT date, COUNT(DISTINCT user_id) as count
      FROM daily_activity
      WHERE date >= CURRENT_DATE - ${days}::integer
      GROUP BY date
      ORDER BY date
    `;
    return result.map((r: any) => ({ date: r.date?.toISOString?.()?.slice(0, 10) || r.date, count: Number(r.count) }));
  }

  async getRetention(cohortDate: string): Promise<{ day1: number; day7: number; day30: number }> {
    const result = await this.prisma.$queryRaw<any[]>`
      WITH cohort AS (
        SELECT id, created_at::date as signup_date
        FROM users
        WHERE created_at::date = ${cohortDate}::date
      )
      SELECT
        (SELECT COUNT(*) FROM daily_activity da JOIN cohort c ON da.user_id = c.id WHERE da.date = c.signup_date + 1)::float /
        NULLIF((SELECT COUNT(*) FROM cohort), 0) * 100 as day1,
        (SELECT COUNT(*) FROM daily_activity da JOIN cohort c ON da.user_id = c.id WHERE da.date = c.signup_date + 7)::float /
        NULLIF((SELECT COUNT(*) FROM cohort), 0) * 100 as day7,
        (SELECT COUNT(*) FROM daily_activity da JOIN cohort c ON da.user_id = c.id WHERE da.date = c.signup_date + 30)::float /
        NULLIF((SELECT COUNT(*) FROM cohort), 0) * 100 as day30
    `;
    return {
      day1: Math.round(Number(result[0]?.day1 || 0)),
      day7: Math.round(Number(result[0]?.day7 || 0)),
      day30: Math.round(Number(result[0]?.day30 || 0)),
    };
  }

  async getLessonCompletionRate(days: number = 7): Promise<number> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        (COUNT(*) FILTER (WHERE is_completed = true))::float /
        NULLIF(COUNT(*), 0) * 100 as rate
      FROM lessons_progress
      WHERE lesson_date >= CURRENT_DATE - ${days}::integer
    `;
    return Math.round(Number(result[0]?.rate || 0));
  }

  async getTotalConversationMinutes(days: number = 7): Promise<number> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT COALESCE(SUM(duration_ms), 0) / 60000.0 as minutes
      FROM conversation_sessions
      WHERE created_at >= NOW() - ${days}::integer * INTERVAL '1 day'
    `;
    return Math.round(Number(result[0]?.minutes || 0));
  }

  async getPronunciationImprovement(days: number = 7): Promise<number> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT AVG(overall_score) as avg_score
      FROM pronunciation_analysis
      WHERE created_at >= NOW() - ${days}::integer * INTERVAL '1 day'
    `;
    return Math.round(Number(result[0]?.avg_score || 0));
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    for (const point of batch) {
      this.logger.debug(`Metric: ${point.name} = ${point.value} ${JSON.stringify(point.labels || {})}`);
    }
  }
}
