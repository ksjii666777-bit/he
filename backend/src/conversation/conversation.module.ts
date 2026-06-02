import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ConversationGateway } from './conversation.gateway';
import { ConversationSessionService } from './conversation-session.service';

@Module({
  imports: [
    AiGatewayModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  providers: [ConversationGateway, ConversationSessionService],
  exports: [ConversationSessionService],
})
export class ConversationModule {}
