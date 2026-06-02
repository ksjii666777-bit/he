import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoadmapsModule } from './roadmaps/roadmaps.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { SpeechModule } from './speech/speech.module';
import { ConversationModule } from './conversation/conversation.module';
import { LearningModule } from './learning/learning.module';
import { ProgressModule } from './progress/progress.module';
import { VocabularyModule } from './vocabulary/vocabulary.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { FeedbackModule } from './feedback/feedback.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { appConfig, authConfig } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [appConfig, authConfig],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    RateLimitModule,
    AuthModule,
    UsersModule,
    RoadmapsModule,
    AiGatewayModule,
    SpeechModule,
    ConversationModule,
    LearningModule,
    ProgressModule,
    VocabularyModule,
    HealthModule,
    MonitoringModule,
    OnboardingModule,
    FeedbackModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
