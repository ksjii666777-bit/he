import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CostGuard } from '../../src/ai-gateway/cost-guard';

describe('CostGuard', () => {
  let costGuard: CostGuard;
  let configService: ConfigService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'MONTHLY_HARD_CAP_CENTS') return '120000';
              if (key === 'DAILY_USER_LIMIT_CENTS') return '10';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    costGuard = module.get<CostGuard>(CostGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (costGuard as any).costStore = new Map();
    (costGuard as any).userDailyStore = new Map();
    (costGuard as any).userAvgStore = new Map();
  });

  describe('Monthly Hard Cap', () => {
    it('should allow requests under monthly cap', async () => {
      const allowed = await costGuard.checkQuota('user-1');
      expect(allowed).toBe(true);
    });

    it('should block requests when monthly cap is exceeded', async () => {
      for (let i = 0; i < 100; i++) {
        await costGuard.trackCost('user-1', 2000);
      }

      const allowed = await costGuard.checkQuota('user-1');
      expect(allowed).toBe(false);
    });

    it('should return system monthly cost', async () => {
      await costGuard.trackCost('user-cost', 100);
      const cost = costGuard.getSystemMonthlyCost();
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Daily User Limit', () => {
    it('should allow requests under daily user limit', async () => {
      const allowed = await costGuard.checkQuota('user-daily-1');
      expect(allowed).toBe(true);
    });

    it('should block requests when daily user limit exceeded', async () => {
      for (let i = 0; i < 50; i++) {
        await costGuard.trackCost('user-daily-2', 100);
      }

      const allowed = await costGuard.checkQuota('user-daily-2');
      expect(allowed).toBe(false);
    });
  });

  describe('Anomaly Detection', () => {
    it('should allow normal usage patterns', async () => {
      for (let i = 0; i < 4; i++) {
        await costGuard.trackCost('user-normal', 2);
      }

      const allowed = await costGuard.checkQuota('user-normal');
      expect(allowed).toBe(true);
    });

    it('should block anomalous usage spikes', async () => {
      for (let i = 0; i < 5; i++) {
        await costGuard.trackCost('user-anomaly', 1);
      }

      await costGuard.trackCost('user-anomaly', 500);

      const allowed = await costGuard.checkQuota('user-anomaly');
      expect(allowed).toBe(false);
    });

    it('should calculate user daily average', async () => {
      await costGuard.trackCost('user-avg', 10);
      const avg = costGuard.getUserDailyAverage('user-avg');
      expect(avg).toBeGreaterThan(0);
    });
  });

  describe('Cost Tracking', () => {
    it('should accumulate costs per provider', async () => {
      await costGuard.trackCost('user-provider', 100);

      const monthly = costGuard.getSystemMonthlyCost();
      expect(monthly).toBeGreaterThan(0);
    });

    it('should return per-user daily cost', async () => {
      await costGuard.trackCost('user-cost-1', 50);
      const daily = costGuard.getUserDailyCost('user-cost-1');
      expect(daily).toBe(50);
    });
  });
});
