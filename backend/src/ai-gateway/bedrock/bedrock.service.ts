import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BedrockResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  costCents: number;
  latencyMs: number;
}

export interface BedrockHealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  apiKeyConfigured: boolean;
  region: string;
  models: {
    sonnet: { id: string; available: boolean };
    haiku: { id: string; available: boolean };
  };
}

export class BedrockError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerError?: string,
  ) {
    super(message);
    this.name = 'BedrockError';
  }
}

export class BedrockTimeoutError extends BedrockError {
  constructor(message: string) {
    super(message);
    this.name = 'BedrockTimeoutError';
  }
}

export class BedrockRateLimitError extends BedrockError {
  constructor(message: string) {
    super(message, 429);
    this.name = 'BedrockRateLimitError';
  }
}

const BEDROCK_PRICING: Record<string, { input: number; output: number }> = {
  'us.anthropic.claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1.0, output: 5.0 },
};

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly apiKey: string;
  private readonly region: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sonnetModel: string;
  private readonly haikuModel: string;
  private totalCostCents = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('BEDROCK_API_KEY') || '';
    this.region = config.get<string>('AWS_REGION') || 'us-east-1';
    this.timeoutMs = parseInt(config.get<string>('BEDROCK_TIMEOUT_MS') || '30000', 10);
    this.maxRetries = parseInt(config.get<string>('BEDROCK_MAX_RETRIES') || '3', 10);
    this.sonnetModel = config.get<string>('BEDROCK_SONNET_MODEL') ||
      'us.anthropic.claude-sonnet-4-6';
    this.haikuModel = config.get<string>('BEDROCK_HAIKU_MODEL') ||
      'us.anthropic.claude-haiku-4-5-20251001-v1:0';

    this.baseUrl = `https://bedrock-runtime.${this.region}.amazonaws.com`;

    if (!this.apiKey) {
      this.logger.warn('BEDROCK_API_KEY not set — Bedrock calls will fail');
    }
  }

  async generate(
    prompt: string,
    options: {
      model?: 'sonnet' | 'haiku';
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<BedrockResponse> {
    const modelId = options.model === 'haiku' ? this.haikuModel : this.sonnetModel;
    const maxTokens = options.maxTokens || (options.model === 'haiku' ? 1024 : 4096);
    const temperature = options.temperature ?? 0.7;

    return this.invokeWithRetry(modelId, prompt, maxTokens, temperature);
  }

  async generateLesson(prompt: string): Promise<BedrockResponse> {
    return this.generate(prompt, { model: 'sonnet', maxTokens: 4096, temperature: 0.7 });
  }

  async generateConversation(prompt: string): Promise<BedrockResponse> {
    return this.generate(prompt, { model: 'haiku', maxTokens: 1024, temperature: 0.8 });
  }

  async generateRoadmap(prompt: string): Promise<BedrockResponse> {
    return this.generate(prompt, { model: 'sonnet', maxTokens: 4096, temperature: 0.5 });
  }

  private async invokeWithRetry(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
  ): Promise<BedrockResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.invokeBedrock(modelId, prompt, maxTokens, temperature);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof BedrockRateLimitError) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          this.logger.warn(`Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delay);
          continue;
        }

        if (err instanceof BedrockTimeoutError) {
          this.logger.warn(`Timeout, retrying (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(1000 * (attempt + 1));
          continue;
        }

        break;
      }
    }

    throw lastError || new BedrockError('All Bedrock retries exhausted');
  }

  private async invokeBedrock(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
  ): Promise<BedrockResponse> {
    if (!this.apiKey) {
      throw new BedrockError('BEDROCK_API_KEY not configured');
    }

    const body = {
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      max_tokens: maxTokens,
      temperature,
    };

    const url = `${this.baseUrl}/model/${modelId}/converse`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new BedrockRateLimitError('Bedrock rate limit exceeded');
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        throw new BedrockError(
          `Bedrock API error ${response.status}: ${errorBody}`,
          response.status,
          errorBody,
        );
      }

      const data = await response.json();
      const content = data.output?.message?.content?.[0]?.text || '';
      const inputTokens = data.usage?.inputTokens || 0;
      const outputTokens = data.usage?.outputTokens || 0;
      const latencyMs = data.metrics?.latencyMs || (Date.now() - startTime);
      const costCents = this.calculateCost(modelId, inputTokens, outputTokens);

      this.totalCostCents += costCents;

      return {
        content,
        inputTokens,
        outputTokens,
        model: modelId,
        costCents,
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof BedrockError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new BedrockTimeoutError(
          `Bedrock request timed out after ${this.timeoutMs}ms`,
        );
      }

      throw new BedrockError(
        `Bedrock request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const pricing = BEDROCK_PRICING[modelId] || { input: 0, output: 0 };
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  async healthCheck(): Promise<BedrockHealthStatus> {
    const models: BedrockHealthStatus['models'] = {
      sonnet: { id: this.sonnetModel, available: false },
      haiku: { id: this.haikuModel, available: false },
    };

    if (!this.apiKey) {
      return {
        status: 'unhealthy',
        apiKeyConfigured: false,
        region: this.region,
        models,
      };
    }

    try {
      const result = await this.generate('Reply with exactly: ok', {
        model: 'haiku',
        maxTokens: 10,
        temperature: 0,
      });
      models.haiku.available = result.content.toLowerCase().includes('ok');
    } catch {
      models.haiku.available = false;
    }

    return {
      status: models.haiku.available ? 'ok' : 'degraded',
      apiKeyConfigured: true,
      region: this.region,
      models,
    };
  }

  getTotalCostCents(): number {
    return this.totalCostCents;
  }

  getModelForTask(taskType: string): 'sonnet' | 'haiku' {
    const sonnetTasks = ['lesson_generation', 'assessment_scoring', 'roadmap_generation'];
    return sonnetTasks.includes(taskType) ? 'sonnet' : 'haiku';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
