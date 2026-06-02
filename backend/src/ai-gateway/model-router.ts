import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { countTokens, estimateCost } from './token-counter';

export type TaskType =
  | 'lesson_generation'
  | 'conversation'
  | 'error_correction'
  | 'assessment_scoring'
  | 'roadmap_generation'
  | 'content_validation';

export interface ModelRoute {
  primary: { provider: 'claude' | 'openai'; model: string };
  fallback: { provider: 'claude' | 'openai'; model: string };
}

export interface AIResponse<T = any> {
  content: T;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
  wasFallback: boolean;
}

const TASK_ROUTES: Record<TaskType, ModelRoute> = {
  lesson_generation: {
    primary: { provider: 'claude', model: 'claude-3-sonnet' },
    fallback: { provider: 'openai', model: 'gpt-4o' },
  },
  conversation: {
    primary: { provider: 'claude', model: 'claude-3-haiku' },
    fallback: { provider: 'openai', model: 'gpt-4o-mini' },
  },
  error_correction: {
    primary: { provider: 'claude', model: 'claude-3-haiku' },
    fallback: { provider: 'openai', model: 'gpt-4o-mini' },
  },
  assessment_scoring: {
    primary: { provider: 'claude', model: 'claude-3-sonnet' },
    fallback: { provider: 'openai', model: 'gpt-4o' },
  },
  roadmap_generation: {
    primary: { provider: 'claude', model: 'claude-3-sonnet' },
    fallback: { provider: 'openai', model: 'gpt-4o' },
  },
  content_validation: {
    primary: { provider: 'claude', model: 'claude-3-haiku' },
    fallback: { provider: 'openai', model: 'gpt-4o-mini' },
  },
};

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};

class CircuitBreaker {
  private state = new Map<
    string,
    { failures: number; lastFailure: number; openUntil: number }
  >();
  private readonly threshold = 3;
  private readonly cooldownMs = 300000;

  isAvailable(provider: string): boolean {
    const s = this.state.get(provider);
    if (!s || s.failures < this.threshold) return true;
    if (Date.now() > s.openUntil) {
      s.openUntil = Date.now() + this.cooldownMs;
      return true;
    }
    return false;
  }

  recordFailure(provider: string): void {
    const s = this.state.get(provider) || {
      failures: 0,
      lastFailure: 0,
      openUntil: 0,
    };
    s.failures++;
    s.lastFailure = Date.now();
    if (s.failures >= this.threshold) {
      s.openUntil = Date.now() + this.cooldownMs;
    }
    this.state.set(provider, s);
  }

  recordSuccess(provider: string): void {
    this.state.delete(provider);
  }
}

@Injectable()
export class ModelRouter {
  private circuitBreaker = new CircuitBreaker();
  private config: ConfigService;

  constructor(config: ConfigService) {
    this.config = config;
  }

  async generate<T = any>(
    taskType: string,
    prompt: string,
    options?: { userId?: string; isFallback?: boolean },
  ): Promise<AIResponse<T>> {
    return this.execute<T>(
      taskType as TaskType,
      prompt,
      options?.userId || 'system',
    );
  }

  async execute<T>(
    task: TaskType,
    prompt: string,
    userId: string,
  ): Promise<AIResponse<T>> {
    const route = TASK_ROUTES[task];
    const startTime = Date.now();
    let lastError: Error | null = null;
    let wasFallback = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!this.circuitBreaker.isAvailable(route.primary.provider)) {
          break;
        }
        const result = await this.callProvider<T>(
          route.primary,
          prompt,
          attempt,
        );
        this.circuitBreaker.recordSuccess(route.primary.provider);
        return this.measureResponse(result, route.primary, startTime, false);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (
          err instanceof RateLimitError ||
          err instanceof TimeoutError
        ) {
          await this.sleep(Math.pow(2, attempt) * 1000 + Math.random() * 1000);
          continue;
        }
        this.circuitBreaker.recordFailure(route.primary.provider);
        break;
      }
    }

    wasFallback = true;
    try {
      const result = await this.callProvider<T>(route.fallback, prompt, 0);
      this.circuitBreaker.recordSuccess(route.fallback.provider);
      return this.measureResponse(result, route.fallback, startTime, true);
    } catch (err) {
      throw new AIProvidersUnavailableError(
        'All AI providers unavailable',
        lastError,
      );
    }
  }

  private async callProvider<T>(
    route: { provider: string; model: string },
    prompt: string,
    attempt: number,
  ): Promise<T> {
    const apiKey =
      route.provider === 'claude'
        ? this.config.get<string>('ANTHROPIC_API_KEY')
        : this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error(`${route.provider} API key not configured`);
    }

    const url =
      route.provider === 'claude'
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://api.openai.com/v1/chat/completions';

    const isConversation =
      TASK_ROUTES.conversation.primary.model === route.model;
    const maxTokens = isConversation ? 1024 : 4096;

    const body =
      route.provider === 'claude'
        ? {
            model: route.model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }
        : {
            model: route.model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          };

    this._promptForTokens = prompt;
    this._maxTokens = maxTokens;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(route.provider === 'claude'
            ? {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              }
            : { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new RateLimitError('Rate limited');
      }
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content =
        route.provider === 'claude'
          ? data.content[0].text
          : data.choices[0].message.content;

      this._outputLength = content.length;

      return JSON.parse(content);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private _promptForTokens: string = '';
  private _maxTokens: number = 4096;
  private _outputLength: number = 500;

  private measureResponse<T>(
    content: T,
    route: { provider: string; model: string },
    startTime: number,
    wasFallback: boolean,
  ): AIResponse<T> {
    const inputTokens = countTokens(this._promptForTokens);
    const outputTokens =
      this._outputLength > 0
        ? countTokens(JSON.stringify(content).slice(0, this._outputLength))
        : countTokens(JSON.stringify(content));
    const costCents = estimateCost(route.model, inputTokens, outputTokens);

    this._promptForTokens = '';
    this._outputLength = 0;

    return {
      content,
      provider: route.provider,
      model: route.model,
      inputTokens,
      outputTokens,
      costCents: Math.round(costCents * 10000) / 10000,
      latencyMs: Date.now() - startTime,
      wasFallback,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TimeoutError';
  }
}

export class AIProvidersUnavailableError extends Error {
  public cause: Error | null;

  constructor(msg: string, cause?: Error | null) {
    super(msg);
    this.name = 'AIProvidersUnavailableError';
    this.cause = cause || null;
  }
}
