import { Injectable } from '@nestjs/common';

export interface Sm5Result {
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReviewDate: string;
}

@Injectable()
export class Sm5Service {
  private readonly MIN_EF = 1.3;
  private readonly MAX_INTERVAL_DAYS = 365;

  calculate(
    quality: number,
    previousInterval: number = 0,
    previousRepetitions: number = 0,
    previousEaseFactor: number = 2.5,
  ): Sm5Result {
    let ef = previousEaseFactor;
    let interval: number;
    let reps = previousRepetitions;

    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < this.MIN_EF) ef = this.MIN_EF;

    if (quality < 3) {
      reps = 0;
      interval = 1;
    } else {
      reps++;
      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.round(Math.max(1, previousInterval) * ef);
      }
    }

    interval = Math.max(1, Math.min(interval, this.MAX_INTERVAL_DAYS));

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);

    return {
      interval,
      repetitions: reps,
      easeFactor: Math.round(ef * 100) / 100,
      nextReviewDate: nextDate.toISOString(),
    };
  }
}
