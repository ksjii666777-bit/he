import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../common/prisma/prisma.service';
import { OpenRouterService } from '../ai-gateway/openrouter/openrouter.service';
import { ContentValidator } from '../ai-gateway/validators/content-validator';
import { CostGuard } from '../ai-gateway/cost-guard';
import { buildConversationPrompt } from '../ai-gateway/prompts/conversation.v1';
import { RedisService } from '../common/redis/redis.service';

interface Session {
  id: string;
  userId: string;
  scenario: string;
  level: number;
  history: { role: 'user' | 'assistant'; content: string }[];
  firstPrompt: string;
  status: 'active' | 'ended';
  createdAt: Date;
}

interface Reply {
  response: string;
  corrections: { incorrect: string; correct: string; explanation: string }[];
  score: number;
}

@Injectable()
export class ConversationSessionService {
  private readonly logger = new Logger(ConversationSessionService.name);
  private sessions = new Map<string, Session>();
  private processedMessages = new Map<string, Set<string>>();

  private readonly SCENARIO_FIRST_PROMPTS: Record<string, string> = {
    'ordering-food':
      "Welcome! What would you like to order today? We have burgers, pizza, salad, and pasta.",
    'introducing-self':
      "Hi there! It's nice to meet you. My name's Alex. What's your name?",
    'asking-directions':
      "Hello! Are you looking for somewhere? I know this area pretty well.",
    'shopping':
      "Welcome to the store! Are you looking for anything specific today?",
    'making-appointment':
      "Good morning! Thanks for calling. How can I help you today?",
    'small-talk':
      "Hey! How's your day going? The weather's been lovely lately, hasn't it?",
    'hotel-checkin':
      "Welcome to Grand Hotel! Do you have a reservation with us?",
    'job-interview':
      "Thanks for coming in today. Why don't you start by telling me a bit about yourself?",
    'emergency':
      "Hello, this is 911. What's your emergency? Please stay calm and tell me what happened.",
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: OpenRouterService,
    private readonly validator: ContentValidator,
    private readonly costGuard: CostGuard,
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: RedisService,
  ) {}

  private readonly SESSION_TTL = 86400;
  private readonly PROCESSED_TTL = 3600;

  async createSession(
    userId: string,
    scenario: string,
    level: number,
  ): Promise<{ id: string; firstPrompt: string }> {
    const existingKey = `session:active:${userId}`;
    const existingId = await this.redis.get(existingKey);
    if (existingId) {
      const existing = await this.loadSession(existingId);
      if (existing) return { id: existing.id, firstPrompt: existing.firstPrompt };
    }

    const sessionId = crypto.randomUUID();
    const firstPrompt =
      this.SCENARIO_FIRST_PROMPTS[scenario] || 'Hello! How can I help you today?';

    const session: Session = {
      id: sessionId,
      userId,
      scenario,
      level,
      history: [],
      firstPrompt,
      status: 'active',
      createdAt: new Date(),
    };

    await this.saveSession(session);
    await this.redis.set(existingKey, sessionId, this.SESSION_TTL);

    return { id: sessionId, firstPrompt };
  }

  async getActiveSession(userId: string): Promise<Session | null> {
    const key = `session:active:${userId}`;
    const sessionId = await this.redis.get(key);
    if (!sessionId) return null;
    return this.loadSession(sessionId);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.loadSession(sessionId);
  }

  async isMessageProcessed(
    sessionId: string,
    messageId: string,
  ): Promise<boolean> {
    const key = `session:processed:${sessionId}`;
    const processed = await this.redis.get(key);
    if (!processed) return false;
    const ids = JSON.parse(processed);
    return ids.includes(messageId);
  }

  async getLastReply(sessionId: string): Promise<any> {
    const key = `conversation:${sessionId}:lastReply`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async processMessage(
    sessionId: string,
    text: string,
    messageId: string,
  ): Promise<Reply> {
    const session = await this.loadSession(sessionId);
    if (!session) throw new Error('Session not found');

    const processedKey = `session:processed:${sessionId}`;
    const processed = JSON.parse((await this.redis.get(processedKey)) || '[]');
    if (!processed.includes(messageId)) {
      processed.push(messageId);
      await this.redis.set(processedKey, JSON.stringify(processed), this.PROCESSED_TTL);
    }

    session.history.push({ role: 'user', content: text });

    const canProceed = await this.costGuard.checkQuota(session.userId);
    if (!canProceed) {
      return {
        response: "I'm sorry, I can't process this right now. Please try again later.",
        corrections: [],
        score: 0,
      };
    }

    const prompt = buildConversationPrompt({
      level: session.level,
      scenario: session.scenario,
      nativeLanguage: 'unknown',
      cefrLevel: `A${Math.min(3, session.level)}`,
      recentErrors: [],
      conversationHistory: session.history,
      userTurn: text,
    });

    const aiResponse = await this.bedrock.generateConversation(prompt);

    let parsed: any;
    try {
      parsed = JSON.parse(aiResponse.content);
    } catch {
      parsed = {
        response: aiResponse.content,
        corrections: [],
        score: 75,
      };
    }

    const validation = this.validator.validateConversation(parsed);
    if (!validation.passed) {
      return {
        response: "I didn't quite understand that. Could you please say it again?",
        corrections: [],
        score: 0,
      };
    }

    if (validation.confidence < 70) {
      parsed.response += '\n\n(Note: I\'m not entirely sure about my response.)';
    }

    const reply: Reply = {
      response: parsed.response || aiResponse.content,
      corrections: parsed.corrections || [],
      score: parsed.score || 75,
    };

    session.history.push({ role: 'assistant', content: reply.response });

    await this.costGuard.trackCost(
      session.userId,
      aiResponse.costCents || 0,
    );

    this.eventEmitter.emit('conversation.ended', {
      sessionId,
      userId: session.userId,
      scenario: session.scenario,
      turnCount: session.history.length / 2,
      overallScore: reply.score,
    });

    await this.saveSession(session);
    await this.redis.set(
      `conversation:${sessionId}:lastReply`,
      JSON.stringify(reply),
      300,
    );

    return reply;
  }

  async endSession(sessionId: string): Promise<any> {
    const session = await this.loadSession(sessionId);
    if (!session) throw new Error('Session not found');
    session.status = 'ended';

    const totalTurns = session.history.length / 2;
    const scores = session.history
      .filter((_, i) => i % 2 === 1)
      .map(() => 75);
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    this.eventEmitter.emit('conversation.ended', {
      sessionId,
      userId: session.userId,
      scenario: session.scenario,
      turnCount: totalTurns,
      overallScore: avgScore,
    });

    await this.redis.del(`session:active:${session.userId}`);
    await this.redis.del(`session:data:${sessionId}`);
    await this.redis.del(`session:processed:${sessionId}`);
    await this.redis.del(`conversation:${sessionId}:lastReply`);

    return {
      sessionId,
      turnCount: totalTurns,
      overallScore: avgScore,
      summary: `You completed a ${session.scenario} conversation with ${totalTurns} exchanges.`,
    };
  }

  async getHistory(
    sessionId: string,
    after?: string,
  ): Promise<{ role: string; content: string; timestamp: string }[]> {
    const session = await this.loadSession(sessionId);
    if (!session) return [];
    return session.history
      .filter((_, i) => !after || i > session.history.findIndex((h) => h.content === after))
      .map((h) => ({
        role: h.role,
        content: h.content,
        timestamp: session.createdAt.toISOString(),
      }));
  }

  private async saveSession(session: Session): Promise<void> {
    const key = `session:data:${session.id}`;
    const serialized = JSON.stringify({
      id: session.id,
      userId: session.userId,
      scenario: session.scenario,
      level: session.level,
      history: session.history,
      firstPrompt: session.firstPrompt,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    });
    await this.redis.set(key, serialized, this.SESSION_TTL);
  }

  private async loadSession(sessionId: string): Promise<Session | null> {
    const key = `session:data:${sessionId}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      ...data,
      createdAt: new Date(data.createdAt),
    };
  }
}
