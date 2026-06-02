import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ModelRouter, RateLimitError, TimeoutError, AIProvidersUnavailableError } from '../../src/ai-gateway/model-router';

describe('ModelRouter — Failure Recovery', () => {
  let router: ModelRouter;
  let configService: ConfigService;
  let fetchMock: jest.SpyInstance;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelRouter,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-test';
              if (key === 'OPENAI_API_KEY') return 'sk-openai-test';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    router = module.get<ModelRouter>(ModelRouter);
    configService = module.get<ConfigService>(ConfigService);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockReset();
    (router as any)?.circuitBreaker?.state?.clear();
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after 3 consecutive failures', async () => {
      fetchMock.mockRejectedValue(new Error('API unavailable'));

      for (let i = 0; i < 3; i++) {
        try {
          await router.execute('conversation', 'test prompt', 'user-1');
        } catch {
          // expected
        }
      }

      await expect(
        router.execute('conversation', 'test prompt', 'user-1'),
      ).rejects.toThrow(AIProvidersUnavailableError);
    });

    it('should fall back to OpenAI when Claude fails', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('anthropic')) {
          callCount++;
          if (callCount <= 1) {
            throw new RateLimitError('Rate limited');
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ response: 'Fallback response', corrections: [], score: 75 }) } }],
          }),
        };
      });

      const result = await router.execute('conversation', 'test prompt', 'user-2');
      expect(result.wasFallback).toBe(true);
      expect(result.provider).toBe('openai');
    });
  });

  describe('Retry with Backoff', () => {
    it('should retry on rate limit', async () => {
      let attempts = 0;
      fetchMock.mockImplementation(async (url: string) => {
        attempts++;
        if (attempts < 3) {
          return { ok: false, status: 429 };
        }
        const isClaude = url.includes('anthropic');
        return {
          ok: true,
          status: 200,
          json: async () => isClaude
            ? { content: [{ text: JSON.stringify({ response: 'OK', corrections: [], score: 80 }) }] }
            : { choices: [{ message: { content: JSON.stringify({ response: 'OK', corrections: [], score: 80 }) } }] },
        };
      });

      const start = Date.now();
      const result = await router.execute('lesson_generation', 'test', 'user-3');
      const duration = Date.now() - start;

      expect(result.wasFallback).toBe(false);
      expect(attempts).toBeGreaterThanOrEqual(2);
      expect(duration).toBeGreaterThan(1000);
    });

    it('should give up after all retries exhausted', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 });

      await expect(
        router.execute('conversation', 'test', 'user-4'),
      ).rejects.toThrow();
    }, 30000);
  });

  describe('API Key Missing', () => {
    it('should throw when API key is missing', async () => {
      fetchMock.mockImplementation(async (_url: string, options: any) => {
        const body = JSON.parse(options.body);
        if (!options.headers?.['x-api-key'] && !options.headers?.['Authorization']) {
          throw new Error('No API key');
        }
        return { ok: true, status: 200, json: async () => ({ content: [{ text: '{}' }] }) };
      });

      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          ModelRouter,
          {
            provide: ConfigService,
            useValue: { get: () => undefined },
          },
        ],
      }).compile();

      const routerNoKey = module2.get<ModelRouter>(ModelRouter);

      await expect(
        routerNoKey.execute('lesson_generation', 'test', 'user-5'),
      ).rejects.toThrow();
    });
  });
});
