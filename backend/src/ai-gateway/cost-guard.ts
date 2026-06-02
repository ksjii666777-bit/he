import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CostGuard {
  private readonly logger = new Logger(CostGuard.name);
  private readonly MONTHLY_HARD_CAP: number;
  private readonly DAILY_USER_LIMIT_CENTS: number;
  private readonly ANOMALY_MULTIPLIER = 10;
  private costStore: Map<string, number> = new Map();
  private userDailyStore: Map<string, number> = new Map();
  private userAvgStore: Map<string, { total: number; count: number }> =
    new Map();

  constructor(config: ConfigService) {
    this.MONTHLY_HARD_CAP =
      parseInt(config.get<string>('MONTHLY_HARD_CAP_CENTS') || '120000', 10);
    this.DAILY_USER_LIMIT_CENTS =
      parseInt(config.get<string>('DAILY_USER_LIMIT_CENTS') || '10', 10);
  }

  async checkQuota(userId: string): Promise<boolean> {
    const systemMonthly = this.getSystemMonthlyCost();
    const userDaily = this.getUserDailyCost(userId);

    if (systemMonthly >= this.MONTHLY_HARD_CAP) {
      this.logger.error(`Monthly hard cap reached: $${systemMonthly}`);
      return false;
    }

    if (userDaily >= this.DAILY_USER_LIMIT_CENTS) {
      this.logger.warn(`User ${userId} daily limit reached: $${userDaily}`);
      return false;
    }

    const userAvg = this.getUserDailyAverage(userId);
    if (userDaily > 0 && userDaily > userAvg * this.ANOMALY_MULTIPLIER) {
      this.logger.warn(
        `Anomaly detected for user ${userId}: $${userDaily} vs avg $${userAvg}`,
      );
      return false;
    }

    return true;
  }

  async trackCost(userId: string, costCents: number): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const monthKey = new Date().toISOString().slice(0, 7);
    const userDayKey = `${userId}:${today}`;
    const userAvgKey = userId;

    const monthTotal = (this.costStore.get(monthKey) || 0) + costCents;
    this.costStore.set(monthKey, monthTotal);

    const userDayTotal =
      (this.userDailyStore.get(userDayKey) || 0) + costCents;
    this.userDailyStore.set(userDayKey, userDayTotal);

    const avg = this.userAvgStore.get(userAvgKey) || { total: 0, count: 0 };
    avg.total += costCents;
    avg.count++;
    this.userAvgStore.set(userAvgKey, avg);

    const monthly = this.getSystemMonthlyCost();
    if (monthly >= this.MONTHLY_HARD_CAP * 0.8) {
      this.logger.warn(
        `80% of monthly cap reached: $${monthly} / $${this.MONTHLY_HARD_CAP}`,
      );
    }
  }

  getSystemMonthlyCost(): number {
    const monthKey = new Date().toISOString().slice(0, 7);
    return this.costStore.get(monthKey) || 0;
  }

  getUserDailyCost(userId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.userDailyStore.get(`${userId}:${today}`) || 0;
  }

  getUserDailyAverage(userId: string): number {
    const avg = this.userAvgStore.get(userId);
    if (!avg || avg.count === 0) return 0;
    return avg.total / avg.count;
  }

  getMonthlyCostByProvider(provider: string): number {
    const monthKey = new Date().toISOString().slice(0, 7);
    return (
      this.costStore.get(`${monthKey}:${provider}`) ||
      this.costStore.get(monthKey) ||
      0
    );
  }
}
