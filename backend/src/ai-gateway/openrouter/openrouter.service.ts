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

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private totalCostCents = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('OPENROUTER_API_KEY') || '';
    this.model = config.get<string>('OPENROUTER_MODEL') || 'qwen/qwen3-next-80b-a3b-instruct';
    this.timeoutMs = parseInt(config.get<string>('OPENROUTER_TIMEOUT_MS') || '30000', 10);
    this.maxRetries = parseInt(config.get<string>('OPENROUTER_MAX_RETRIES') || '3', 10);

    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set — OpenRouter calls will fail');
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
    const maxTokens = options.maxTokens || (options.model === 'haiku' ? 1024 : 4096);
    const temperature = options.temperature ?? 0.7;

    return this.invokeWithRetry(this.model, prompt, maxTokens, temperature);
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
        return await this.invokeOpenRouter(modelId, prompt, maxTokens, temperature);
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

    throw lastError || new BedrockError('All OpenRouter retries exhausted');
  }

  private async invokeOpenRouter(
    modelId: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
  ): Promise<BedrockResponse> {
    if (!this.apiKey) {
      throw new BedrockError('OPENROUTER_API_KEY not configured');
    }

    const body = {
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    };

    const url = `${this.baseUrl}/chat/completions`;

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
        throw new BedrockRateLimitError('OpenRouter rate limit exceeded');
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        throw new BedrockError(
          `OpenRouter API error ${response.status}: ${errorBody}`,
          response.status,
          errorBody,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const latencyMs = Date.now() - startTime;
      const costCents = Math.round((data.usage?.cost || 0) * 100);

      this.totalCostCents += costCents;

      return {
        content,
        inputTokens,
        outputTokens,
        model: data.model || modelId,
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
          `OpenRouter request timed out after ${this.timeoutMs}ms`,
        );
      }

      throw new BedrockError(
        `OpenRouter request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async healthCheck(): Promise<BedrockHealthStatus> {
    const modelName = this.model;
    const models: BedrockHealthStatus['models'] = {
      sonnet: { id: modelName, available: false },
      haiku: { id: modelName, available: false },
    };

    if (!this.apiKey) {
      return {
        status: 'unhealthy',
        apiKeyConfigured: false,
        region: 'openrouter',
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
      region: 'openrouter',
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
