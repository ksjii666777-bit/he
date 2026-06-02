import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConversationSessionService } from './conversation-session.service';

interface AuthPayload {
  sub: string;
  email: string;
}

@WebSocketGateway({
  namespace: '/conversation',
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class ConversationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(ConversationGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: ConversationSessionService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.emit('error', { code: 'AUTH_REQUIRED', message: 'Token required' });
        client.disconnect();
        return;
      }
      const payload: AuthPayload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      this.logger.log(`Client connected: ${payload.sub}`);

      const activeSession = await this.sessions.getActiveSession(payload.sub);
      if (activeSession) {
        client.emit('session:restored', activeSession);
      }
    } catch {
      client.emit('error', { code: 'AUTH_FAILED', message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.data.userId}`);
  }

  @SubscribeMessage('conversation:start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { scenario: string; level?: number },
  ): Promise<void> {
    try {
      const session = await this.sessions.createSession(
        client.data.userId,
        data.scenario,
        data.level || 1,
      );
      client.emit('conversation:started', {
        sessionId: session.id,
        scenario: data.scenario,
        level: data.level || 1,
        firstPrompt: session.firstPrompt,
      });
    } catch (err: any) {
      client.emit('error', {
        code: 'SESSION_START_FAILED',
        message: err.message,
      });
    }
  }

  @SubscribeMessage('conversation:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      messageId: string;
      text: string;
      audio?: string;
    },
  ): Promise<void> {
    try {
      const session = await this.sessions.getSession(data.sessionId);
      if (!session || session.userId !== client.data.userId) {
        throw new WsException('Session not found');
      }

      const isDuplicate = await this.sessions.isMessageProcessed(
        data.sessionId,
        data.messageId,
      );
      if (isDuplicate) {
        const lastReply = await this.sessions.getLastReply(data.sessionId);
        client.emit('conversation:reply', lastReply);
        return;
      }

      const reply = await this.sessions.processMessage(
        data.sessionId,
        data.text,
        data.messageId,
      );

      client.emit('conversation:reply', {
        messageId: data.messageId,
        response: reply.response,
        corrections: reply.corrections,
        score: reply.score,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      client.emit('error', {
        code: 'MESSAGE_FAILED',
        message: err.message,
      });
    }
  }

  @SubscribeMessage('conversation:end')
  async handleEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    try {
      const summary = await this.sessions.endSession(data.sessionId);
      client.emit('conversation:ended', summary);
    } catch (err: any) {
      client.emit('error', {
        code: 'SESSION_END_FAILED',
        message: err.message,
      });
    }
  }

  @SubscribeMessage('conversation:history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; after?: string },
  ): Promise<void> {
    try {
      const history = await this.sessions.getHistory(
        data.sessionId,
        data.after,
      );
      client.emit('conversation:history', { messages: history });
    } catch (err: any) {
      client.emit('error', {
        code: 'HISTORY_FAILED',
        message: err.message,
      });
    }
  }
}
