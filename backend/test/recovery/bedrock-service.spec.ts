import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BedrockService,
  BedrockError,
  BedrockTimeoutError,
  BedrockRateLimitError,
} from '../../src/ai-gateway/bedrock/bedrock.service';

describe('BedrockService', () => {
  let service: BedrockService;
  let fetchMock: jest.SpyInstance;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BedrockService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                BEDROCK_API_KEY: 'test-api-key',
                AWS_REGION: 'us-east-1',
                BEDROCK_TIMEOUT_MS: '5000',
                BEDROCK_MAX_RETRIES: '2',
                BEDROCK_SONNET_MODEL: 'us.anthropic.claude-sonnet-4-6',
                BEDROCK_HAIKU_MODEL: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
              };
              return config[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<BedrockService>(BedrockService);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  describe('generate', () => {
    it('should call Bedrock and return parsed response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: JSON.stringify({ title: 'Test Lesson', exercises: [] }) }], role: 'assistant' } },
          usage: { inputTokens: 100, outputTokens: 50 },
          metrics: { latencyMs: 500 },
        }),
      });

      const result = await service.generate('test prompt', { model: 'sonnet' });

      expect(result.content).toContain('Test Lesson');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.model).toBe('us.anthropic.claude-sonnet-4-6');
      expect(result.costCents).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should use haiku model when specified', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{"response": "Hello!"}' }], role: 'assistant' } },
          usage: { inputTokens: 50, outputTokens: 20 },
          metrics: { latencyMs: 300 },
        }),
      });

      const result = await service.generate('test', { model: 'haiku' });

      expect(result.model).toBe('us.anthropic.claude-haiku-4-5-20251001-v1:0');
      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('us.anthropic.claude-haiku-4-5-20251001-v1:0');
    });

    it('should throw BedrockError when API key is missing', async () => {
      const noKeyModule = await Test.createTestingModule({
        providers: [
          BedrockService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => {
                if (key === 'BEDROCK_API_KEY') return '';
                if (key === 'AWS_REGION') return 'us-east-1';
                return undefined;
              },
            },
          },
        ],
      }).compile();

      const noKeyService = noKeyModule.get<BedrockService>(BedrockService);

      await expect(noKeyService.generate('test')).rejects.toThrow(BedrockError);
      await expect(noKeyService.generate('test')).rejects.toThrow('BEDROCK_API_KEY not configured');
    });

    it('should throw BedrockRateLimitError on 429', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      });

      await expect(service.generate('test')).rejects.toThrow(BedrockRateLimitError);
    }, 30000);

    it('should throw BedrockError on non-200 response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'internal error',
      });

      await expect(service.generate('test')).rejects.toThrow(BedrockError);
    }, 30000);

    it('should throw BedrockTimeoutError on abort', async () => {
      fetchMock.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          }, 100);
        });
      });

      await expect(service.generate('test')).rejects.toThrow(BedrockTimeoutError);
    }, 30000);
  });

  describe('Retry Logic', () => {
    it('should retry on rate limit and succeed', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return { ok: false, status: 429, text: async () => 'rate limited' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: { message: { content: [{ text: '{"result": "ok"}' }], role: 'assistant' } },
            usage: { inputTokens: 10, outputTokens: 5 },
            metrics: { latencyMs: 100 },
          }),
        };
      });

      const result = await service.generate('test');
      expect(result.content).toContain('ok');
      expect(callCount).toBe(3);
    });

    it('should exhaust retries and throw', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      });

      await expect(service.generate('test')).rejects.toThrow();
    }, 15000);
  });

  describe('generateLesson', () => {
    it('should use sonnet model with 4096 max tokens', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{"title": "Lesson"}' }], role: 'assistant' } },
          usage: { inputTokens: 200, outputTokens: 300 },
          metrics: { latencyMs: 500 },
        }),
      });

      const svc = await createTestBedrockService();
      const result = await svc.generateLesson('test prompt');
      expect(result.model).toBe('us.anthropic.claude-sonnet-4-6');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(4096);
    });
  });

  describe('generateConversation', () => {
    it('should use haiku model with 1024 max tokens', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{"response": "Hello!"}' }], role: 'assistant' } },
          usage: { inputTokens: 50, outputTokens: 20 },
          metrics: { latencyMs: 300 },
        }),
      });

      const result = await service.generateConversation('test prompt');
      expect(result.model).toBe('us.anthropic.claude-haiku-4-5-20251001-v1:0');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(1024);
    });
  });

  describe('generateRoadmap', () => {
    it('should use sonnet model with 0.5 temperature', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{"recommendations": []}' }], role: 'assistant' } },
          usage: { inputTokens: 100, outputTokens: 100 },
          metrics: { latencyMs: 500 },
        }),
      });

      const result = await service.generateRoadmap('test prompt');
      expect(result.model).toBe('us.anthropic.claude-sonnet-4-6');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.5);
    });
  });

  describe('Cost Tracking', () => {
    it('should accumulate total cost', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{}' }], role: 'assistant' } },
          usage: { inputTokens: 1000, outputTokens: 500 },
          metrics: { latencyMs: 500 },
        }),
      });

      const costBefore = service.getTotalCostCents();
      await service.generate('test', { model: 'sonnet' });
      const costAfter = service.getTotalCostCents();

      expect(costAfter).toBeGreaterThan(costBefore);
    });
  });

  describe('getModelForTask', () => {
    it('should return sonnet for lesson_generation', () => {
      expect(service.getModelForTask('lesson_generation')).toBe('sonnet');
    });

    it('should return sonnet for assessment_scoring', () => {
      expect(service.getModelForTask('assessment_scoring')).toBe('sonnet');
    });

    it('should return sonnet for roadmap_generation', () => {
      expect(service.getModelForTask('roadmap_generation')).toBe('sonnet');
    });

    it('should return haiku for conversation', () => {
      expect(service.getModelForTask('conversation')).toBe('haiku');
    });

    it('should return haiku for error_correction', () => {
      expect(service.getModelForTask('error_correction')).toBe('haiku');
    });

    it('should return haiku for unknown tasks', () => {
      expect(service.getModelForTask('unknown')).toBe('haiku');
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy when API key is missing', async () => {
      const noKeyModule = await Test.createTestingModule({
        providers: [
          BedrockService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => {
                if (key === 'BEDROCK_API_KEY') return '';
                if (key === 'AWS_REGION') return 'us-east-1';
                return undefined;
              },
            },
          },
        ],
      }).compile();

      const noKeyService = noKeyModule.get<BedrockService>(BedrockService);
      const health = await noKeyService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.apiKeyConfigured).toBe(false);
    });

    it('should return ok when Bedrock responds', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: 'ok' }], role: 'assistant' } },
          usage: { inputTokens: 5, outputTokens: 2 },
          metrics: { latencyMs: 200 },
        }),
      });

      const health = await service.healthCheck();

      expect(health.status).toBe('ok');
      expect(health.apiKeyConfigured).toBe(true);
      expect(health.region).toBe('us-east-1');
      expect(health.models.haiku.available).toBe(true);
    });

    it('should return degraded when Bedrock call fails', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const health = await service.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.apiKeyConfigured).toBe(true);
      expect(health.models.haiku.available).toBe(false);
    });
  });

  describe('Request Format', () => {
    it('should send correct Bedrock request body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{}' }], role: 'assistant' } },
          usage: { inputTokens: 10, outputTokens: 5 },
          metrics: { latencyMs: 500 },
        }),
      });

      await service.generate('test prompt', { model: 'sonnet', temperature: 0.3 });

      const [url, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(url).toContain('bedrock-runtime.us-east-1.amazonaws.com');
      expect(url).toContain('us.anthropic.claude-sonnet-4-6');
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.3);
      expect(body.messages).toEqual([{ role: 'user', content: [{ text: 'test prompt' }] }]);
    });

    it('should include correct headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          output: { message: { content: [{ text: '{}' }], role: 'assistant' } },
          usage: { inputTokens: 10, outputTokens: 5 },
          metrics: { latencyMs: 100 },
        }),
      });

      await service.generate('test');

      const options = fetchMock.mock.calls[0][1];
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
    });
  });

  describe('Error Classes', () => {
    it('BedrockError should have correct name and properties', () => {
      const err = new BedrockError('test', 500, 'body');
      expect(err.name).toBe('BedrockError');
      expect(err.message).toBe('test');
      expect(err.statusCode).toBe(500);
      expect(err.providerError).toBe('body');
    });

    it('BedrockTimeoutError should extend BedrockError', () => {
      const err = new BedrockTimeoutError('timeout');
      expect(err.name).toBe('BedrockTimeoutError');
      expect(err).toBeInstanceOf(BedrockError);
    });

    it('BedrockRateLimitError should extend BedrockError', () => {
      const err = new BedrockRateLimitError('rate limited');
      expect(err.name).toBe('BedrockRateLimitError');
      expect(err.statusCode).toBe(429);
      expect(err).toBeInstanceOf(BedrockError);
    });
  });
});

async function createTestBedrockService(): Promise<BedrockService> {
  const module = await Test.createTestingModule({
    providers: [
      BedrockService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            const config: Record<string, string> = {
              BEDROCK_API_KEY: 'test-key',
              AWS_REGION: 'us-east-1',
              BEDROCK_SONNET_MODEL: 'us.anthropic.claude-sonnet-4-6',
              BEDROCK_HAIKU_MODEL: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
            };
            return config[key];
          },
        },
      },
    ],
  }).compile();

  return module.get<BedrockService>(BedrockService);
}
