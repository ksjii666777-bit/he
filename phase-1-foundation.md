# Phase 1 — Implementation Foundation

**Timeline:** Weeks 1–4  
**Depends on:** MVP Architecture V2 (`mvp-architecture-v2.md`)  
**Deliverables:** Repository, Auth, User Profiles, Learning Plans, Database, Infrastructure  

---

## 1. Repository Structure

```
he/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR checks: lint, test, build
│       └── deploy.yml                # Deploy to staging/production
├── backend/                          # NestJS monolith
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   ├── public.decorator.ts
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── jwt-refresh.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── logging.interceptor.ts
│   │   │   │   └── request-id.interceptor.ts
│   │   │   └── prisma/
│   │   │       └── prisma.service.ts
│   │   ├── config/
│   │   │   └── config.module.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── refresh-token.dto.ts
│   │   │   │   └── consent.dto.ts
│   │   │   └── strategies/
│   │   │       ├── jwt.strategy.ts
│   │   │       ├── jwt-refresh.strategy.ts
│   │   │       └── google.strategy.ts
│   │   └── users/
│   │       ├── users.module.ts
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       └── dto/
│   │           ├── update-profile.dto.ts
│   │           └── update-preferences.dto.ts
│   ├── scripts/
│   │   └── backup.ts
│   ├── test/
│   │   ├── app.e2e-spec.ts
│   │   ├── auth.e2e-spec.ts
│   │   └── jest-e2e.json
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   └── nest-cli.json
├── mobile/                           # Flutter app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── app.dart
│   │   ├── app.dart
│   │   ├── core/
│   │   │   ├── api/
│   │   │   │   ├── api_client.dart
│   │   │   │   └── api_exceptions.dart
│   │   │   ├── theme/
│   │   │   │   ├── app_theme.dart
│   │   │   │   └── colors.dart
│   │   │   └── storage/
│   │   │       └── secure_storage.dart
│   │   └── features/
│   │       └── auth/
│   │           ├── data/
│   │           │   ├── auth_repository.dart
│   │           │   └── auth_api.dart
│   │           ├── bloc/
│   │           │   ├── auth_bloc.dart
│   │           │   ├── auth_event.dart
│   │           │   └── auth_state.dart
│   │           └── screens/
│   │               ├── login_screen.dart
│   │               ├── register_screen.dart
│   │               └── onboarding_screen.dart
│   ├── test/
│   ├── pubspec.yaml
│   └── analysis_options.yaml
├── infra/
│   ├── docker/
│   │   ├── backend.Dockerfile
│   │   └── docker-compose.yml
│   └── scripts/
│       ├── setup.sh
│       └── seed.sh
├── docs/
│   ├── mvp-architecture.md
│   ├── mvp-architecture-v2.md
│   ├── mvp-architecture-review.md
│   └── phase-1-foundation.md
├── .env.example
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── package.json                      # Workspace root
├── turbo.json                        # Turborepo config
├── docker-compose.yml                # Dev environment
└── README.md
```

---

## 2. Monorepo Layout

**Tool:** Turborepo (lightweight, zero-config for 2 packages)  

```json
// package.json (root)
{
  "name": "he",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.2.0"
  }
}
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

**Why Turborepo (not Nx or Lerna):** 2 packages (backend + mobile). Turbo is zero-config for this scale. Nx adds unnecessary abstraction. Lerna is maintenance mode.

---

## 3. NestJS Monolith Structure

### 3.1 Module Dependency Graph

```
AppModule
├── ConfigModule         (global — .env config)
├── PrismaModule         (global — DB connection)
├── AuthModule           (register, login, tokens)
├── UsersModule          (profile CRUD, preferences)
└── RoadmapsModule       (learning plan generation)
```

### 3.2 Backend package.json

```json
{
  "name": "@he/backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/schedule": "^10.3.0",
    "@nestjs/swagger": "^7.2.0",
    "@prisma/client": "^5.10.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.1.14",
    "rxjs": "^7.8.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "@types/passport-google-oauth20": "^2.0.14",
    "@types/uuid": "^9.0.7",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "prisma": "^5.10.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.ts$": "ts-jest" },
    "collectCoverageFrom": ["**/*.ts"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

### 3.3 TypeScript Config

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 4. Flutter App Structure

```yaml
# mobile/pubspec.yaml
name: he_app
description: AI-powered language learning app
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  flutter_bloc: ^8.1.3
  bloc: ^8.1.2
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
  json_annotation: ^4.8.1
  equatable: ^2.0.5
  go_router: ^13.0.0
  get_it: ^7.6.4
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1
  build_runner: ^2.4.7
  json_serializable: ^6.7.1
  bloc_test: ^9.1.4
  mocktail: ^1.0.1
```

---

## 5. Prisma Schema

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AuthProvider {
  email
  google
}

enum UserTier {
  free
  premium
}

enum ConsentType {
  voice_recording
  data_processing
  marketing
}

// ── Auth & Users ──

model User {
  id              String    @id @default(uuid()) @db.Uuid
  email           String    @unique
  passwordHash    String?   @map("password_hash")
  authProvider    AuthProvider @default(email) @map("auth_provider")
  authProviderId  String?   @map("auth_provider_id")
  tier            UserTier  @default(free)
  isActive        Boolean   @default(true) @map("is_active")
  consentGranted  Boolean   @default(false) @map("consent_granted")
  consentGrantedAt DateTime? @map("consent_granted_at")
  refreshToken    String?   @map("refresh_token")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  profile              UserProfile?
  languages            UserLanguage[]
  assessments          Assessment[]
  roadmap              Roadmap?
  lessonsProgress      LessonsProgress[]
  userVocabulary       UserVocabulary[]
  speechSessions       SpeechSession[]
  conversationSessions ConversationSession[]
  errorCorrections     ErrorCorrection[]
  dailyActivity        DailyActivity[]
  consentLogs          ConsentLog[]
  aiOutputs            AiOutput[]
  aiOutputFlags        AiOutputFlag[]

  @@index([email])
  @@map("users")
}

model UserProfile {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @unique @map("user_id") @db.Uuid
  name             String
  age              Int?
  countryCode      String   @map("country_code")
  nativeLanguage   String   @map("native_language")
  learningGoal     String   @map("learning_goal")
  dailyStudyMin    Int      @default(15) @map("daily_study_min")
  learningStyle    String   @default("mixed") @map("learning_style")
  teacherMode      String   @default("friendly") @map("teacher_mode")
  onboardingComplete Boolean @default(false) @map("onboarding_complete")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

model UserLanguage {
  id           String @id @default(uuid()) @db.Uuid
  userId       String @map("user_id") @db.Uuid
  languageCode String @map("language_code")
  goalCefr     String @map("goal_cefr")
  isPrimary    Boolean @default(true) @map("is_primary")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, languageCode])
  @@map("user_languages")
}

model ConsentLog {
  id          String       @id @default(uuid()) @db.Uuid
  userId      String       @map("user_id") @db.Uuid
  consentType ConsentType  @map("consent_type")
  granted     Boolean
  ipAddress   String?      @map("ip_address")
  userAgent   String?      @map("user_agent")
  createdAt   DateTime     @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, consentType])
  @@map("consent_logs")
}

// ── Assessments ──

model Assessment {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  languageCode String    @map("language_code")
  type         String
  status       String    @default("in_progress")
  overallScore Decimal?  @map("overall_score") @db.Decimal(5, 2)
  overallCefr  String?   @map("overall_cefr")
  startedAt    DateTime  @default(now()) @map("started_at")
  completedAt  DateTime? @map("completed_at")
  durationSec  Int?      @map("duration_sec")

  user      User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  responses AssessmentResponse[]

  @@index([userId, createdAt])
  @@map("assessments")
}

model AssessmentResponse {
  id             String   @id @default(uuid()) @db.Uuid
  assessmentId   String   @map("assessment_id") @db.Uuid
  sectionType    String   @map("section_type")
  questionType   String   @map("question_type")
  content        Json
  userResponse   Json?    @map("user_response")
  isCorrect      Boolean? @map("is_correct")
  score          Decimal? @db.Decimal(5, 2)
  aiFeedback     String?  @map("ai_feedback")
  audioUrl       String?  @map("audio_url")
  responseTimeMs Int?     @map("response_time_ms")
  difficulty     Int      @default(1)
  createdAt      DateTime @default(now()) @map("created_at")

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)

  @@index([assessmentId])
  @@map("assessment_responses")
}

// ── Roadmaps ──

model Roadmap {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @unique @map("user_id") @db.Uuid
  languageCode   String   @map("language_code")
  durationMonths Int      @map("duration_months")
  startDate      DateTime @map("start_date") @db.Date
  endDate        DateTime @map("end_date") @db.Date
  currentCefr    String   @map("current_cefr")
  targetCefr     String   @map("target_cefr")
  isActive       Boolean  @default(true) @map("is_active")
  generatedAt    DateTime @default(now()) @map("generated_at")

  user       User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  milestones RoadmapMilestone[]

  @@index([userId, languageCode])
  @@map("roadmaps")
}

model RoadmapMilestone {
  id          String    @id @default(uuid()) @db.Uuid
  roadmapId   String    @map("roadmap_id") @db.Uuid
  monthNumber Int       @map("month_number")
  title       String
  description String?
  isCompleted  Boolean   @default(false) @map("is_completed")
  completedAt DateTime? @map("completed_at")
  sortOrder   Int       @map("sort_order")

  roadmap Roadmap @relation(fields: [roadmapId], references: [id], onDelete: Cascade)

  @@index([roadmapId])
  @@map("roadmap_milestones")
}

// ── Learning ──

model LessonsProgress {
  id                 String    @id @default(uuid()) @db.Uuid
  userId             String    @map("user_id") @db.Uuid
  lessonDate         DateTime  @map("lesson_date") @db.Date
  title              String
  cefrLevel          String    @map("cefr_level")
  status             String    @default("in_progress")
  score              Decimal?  @db.Decimal(5, 2)
  timeSpentSec       Int       @default(0) @map("time_spent_sec")
  exercisesTotal     Int       @default(0) @map("exercises_total")
  exercisesCompleted Int       @default(0) @map("exercises_completed")
  content            Json?
  weakAreas          String[]  @map("weak_areas")
  vocabularyLearned  String[]  @map("vocabulary_learned")
  startedAt          DateTime? @map("started_at")
  completedAt        DateTime? @map("completed_at")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonDate])
  @@index([userId, lessonDate])
  @@map("lessons_progress")
}

// ── Vocabulary ──

model VocabularyBank {
  id             String   @id @default(uuid()) @db.Uuid
  languageCode   String   @map("language_code")
  word           String
  transliteration String?
  phonetic       String?
  partOfSpeech   String?  @map("part_of_speech")
  cefrLevel      String?  @map("cefr_level")
  frequencyRank  Int?     @map("frequency_rank")
  definitions    Json?
  examples       Json?
  synonyms       String[]
  commonMistakes Json?    @map("common_mistakes")
  audioUrl       String?  @map("audio_url")
  topicTags      String[] @map("topic_tags")

  userVocabulary UserVocabulary[]

  @@unique([languageCode, word])
  @@index([languageCode, cefrLevel])
  @@map("vocabulary_bank")
}

model UserVocabulary {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  vocabularyId  String   @map("vocabulary_id") @db.Uuid
  status        String   @default("new")
  familiarity   Int      @default(0)
  timesSeen     Int      @default(0)
  timesCorrect  Int      @default(0) @map("times_correct")
  timesWrong    Int      @default(0) @map("times_wrong")
  nextReviewAt  DateTime @default(now()) @map("next_review_at")
  intervalSec   BigInt   @default(0) @map("interval_sec")
  easeFactor    Decimal  @default(2.50) @map("ease_factor") @db.Decimal(4, 2)

  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  vocabulary VocabularyBank @relation(fields: [vocabularyId], references: [id], onDelete: Cascade)

  @@unique([userId, vocabularyId])
  @@index([userId, nextReviewAt])
  @@map("user_vocabulary")
}

// ── Speech ──

model SpeechSession {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @map("user_id") @db.Uuid
  sessionType       String   @map("session_type")
  referenceId       String?  @map("reference_id") @db.Uuid
  languageCode      String   @map("language_code")
  durationMs        Int?     @map("duration_ms")
  audioUrl          String   @map("audio_url")
  transcriptionText String?  @map("transcription_text")
  transcriptionConf Decimal? @map("transcription_conf") @db.Decimal(4, 3)
  noiseLevelDb      Decimal? @map("noise_level_db") @db.Decimal(5, 2)
  status            String   @default("processing")
  createdAt         DateTime @default(now()) @map("created_at")

  user              User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  pronunciationAnalysis PronunciationAnalysis?

  @@index([userId, createdAt])
  @@map("speech_sessions")
}

model PronunciationAnalysis {
  id              String   @id @default(uuid()) @db.Uuid
  speechSessionId String   @unique @map("speech_session_id") @db.Uuid
  overallScore    Decimal  @map("overall_score") @db.Decimal(5, 2)
  fluencyScore    Decimal? @map("fluency_score") @db.Decimal(5, 2)
  grammarScore    Decimal? @map("grammar_score") @db.Decimal(5, 2)
  confidenceScore Decimal? @map("confidence_score") @db.Decimal(5, 2)
  phonemeScores   Json?    @map("phoneme_scores")
  prosodyMetrics  Json?    @map("prosody_metrics")
  errorsDetected  Json?    @map("errors_detected")
  l1Influences    String[] @map("l1_influences")
  createdAt       DateTime @default(now()) @map("created_at")

  session SpeechSession @relation(fields: [speechSessionId], references: [id], onDelete: Cascade)

  @@map("pronunciation_analysis")
}

// ── Conversations ──

model ConversationSession {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  languageCode String   @map("language_code")
  level        Int
  scenario     String
  durationMs   BigInt?  @map("duration_ms")
  messageCount Int      @default(0) @map("message_count")
  avgScore     Decimal? @map("avg_score") @db.Decimal(5, 2)
  status       String   @default("in_progress")
  summary      String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user     User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ConversationMessage[]

  @@map("conversation_sessions")
}

model ConversationMessage {
  id           String   @id @default(uuid()) @db.Uuid
  sessionId    String   @map("session_id") @db.Uuid
  sender       String
  messageOrder Int      @map("message_order")
  text         String
  audioUrl     String?  @map("audio_url")
  transcription String?
  corrections  Json?
  createdAt    DateTime @default(now()) @map("created_at")

  session ConversationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, messageOrder])
  @@map("conversation_messages")
}

// ── Errors ──

model ErrorCorrection {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  languageCode   String   @map("language_code")
  source         String
  sourceId       String?  @map("source_id") @db.Uuid
  category       String
  subcategory    String?
  incorrectText  String   @map("incorrect_text")
  correctText    String   @map("correct_text")
  explanation    String?
  alternatives   String[]
  severity       String   @default("minor")
  createdAt      DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, languageCode, createdAt])
  @@map("error_corrections")
}

// ── Progress ──

model DailyActivity {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @map("user_id") @db.Uuid
  date              DateTime @db.Date
  totalMinutes      Int      @default(0) @map("total_minutes")
  lessonsCompleted  Int      @default(0) @map("lessons_completed")
  exercisesDone     Int      @default(0) @map("exercises_done")
  vocabReviewed     Int      @default(0) @map("vocab_reviewed")
  conversationsHad  Int      @default(0) @map("conversations_had")
  avgScore          Decimal? @map("avg_score") @db.Decimal(5, 2)
  streakDay         Int      @default(0) @map("streak_day")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
  @@map("daily_activity")
}

// ── AI Audit ──

model AiOutput {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  promptType       String   @map("prompt_type")
  promptVersion    String   @map("prompt_version")
  provider         String
  model            String
  inputTokens      Int?     @map("input_tokens")
  outputTokens     Int?     @map("output_tokens")
  costCents        Decimal? @map("cost_cents") @db.Decimal(8, 4)
  latencyMs        Int?     @map("latency_ms")
  validated        Boolean  @default(false)
  validationStatus String?  @map("validation_status")
  passedSafety     Boolean  @default(false) @map("passed_safety")
  wasFallback      Boolean  @default(false) @map("was_fallback")
  createdAt        DateTime @default(now()) @map("created_at")

  user  User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  flags AiOutputFlag[]

  @@index([userId, createdAt])
  @@map("ai_outputs")
}

model AiOutputFlag {
  id          String    @id @default(uuid()) @db.Uuid
  aiOutputId  String    @map("ai_output_id") @db.Uuid
  flagType    String    @map("flag_type")
  severity    String
  description String?
  reviewedBy  String?   @map("reviewed_by") @db.Uuid
  reviewedAt  DateTime? @map("reviewed_at")
  resolution  String?
  createdAt   DateTime  @default(now()) @map("created_at")

  output  AiOutput @relation(fields: [aiOutputId], references: [id], onDelete: Cascade)
  reviewer User?    @relation("FlagReviewer", fields: [reviewedBy], references: [id])

  @@index([reviewedAt])
  @@map("ai_output_flags")
}
```

---

## 6. PostgreSQL Schema (Generated by Prisma)

Prisma generates the SQL from the schema above. The key design decisions are embedded:

| Table | Partition | Indexes | Notes |
|-------|-----------|---------|-------|
| `speech_sessions` | Monthly by `created_at` | `(user_id, created_at DESC)` | Grows ~900K rows/month at 10K DAU |
| `daily_activity` | No | `(user_id, date DESC)` | One row per user per day |
| `assessments` | No | `(user_id, created_at DESC)` | ~3 per user per day |
| `ai_outputs` | No | `(user_id, created_at DESC)` | ~3 per user per day, used for cost tracking |
| `ai_output_flags` | No | `(reviewed_at)` NULLS FIRST | For admin review queue |

---

## 7. Docker Compose Setup

```yaml
# docker-compose.yml
# Development environment — runs full stack locally

version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: he-postgres
    environment:
      POSTGRES_DB: he_dev
      POSTGRES_USER: he_user
      POSTGRES_PASSWORD: he_dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U he_user -d he_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: he-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: he-backend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://he_user:he_dev_password@postgres:5432/he_dev
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-jwt-secret-do-not-use-in-prod
      JWT_REFRESH_SECRET: dev-refresh-secret-do-not-use-in-prod
      JWT_EXPIRATION: 15m
      JWT_REFRESH_EXPIRATION: 7d
    volumes:
      - ./backend/src:/app/src
      - ./backend/prisma:/app/prisma
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "npx prisma migrate dev &&
             npx prisma generate &&
             npm run start:dev"

volumes:
  postgres_data:
  redis_data:
```

```yaml
# infra/docker/backend.Dockerfile
# Production build for Railway/Render deployment

FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

USER nestjs
EXPOSE 3000

CMD ["node", "dist/main"]
```

---

## 8. Environment Variable Design

```bash
# .env.example

# ── App ──
NODE_ENV=development
PORT=3000

# ── Database ──
DATABASE_URL=postgresql://he_user:he_dev_password@localhost:5432/he_dev

# ── Redis ──
REDIS_URL=redis://localhost:6379

# ── Auth ──
JWT_SECRET=replace-with-64-char-random-string
JWT_REFRESH_SECRET=replace-with-64-char-random-string
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ── OAuth ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/v1/auth/oauth/google/callback

# ── Storage ──
S3_REGION=us-east-1
S3_BUCKET=he-app-audio-dev
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# ── AI Providers ──
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# ── Speech Providers ──
DEEPGRAM_API_KEY=
ELEVENLABS_API_KEY=

# ── Email ──
SENDGRID_API_KEY=

# ── Push Notifications ──
FIREBASE_SERVER_KEY=

# ── Monitoring ──
SENTRY_DSN=

# ── Cost Controls ──
MONTHLY_HARD_CAP_CENTS=120000
DAILY_USER_LIMIT_CENTS=10
```

**Secret Management Strategy:**

| Environment | Method | Rotation |
|-------------|--------|----------|
| Development | `.env` file (gitignored) | Manual |
| Staging | Railway/Render secret store | PR-based |
| Production | Railway/Render secret store | 90 days + security events |

---

## 9. CI/CD Pipeline

### 9.1 CI — Pull Request Checks

```yaml
# .github/workflows/ci.yml

name: CI
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

env:
  NODE_VERSION: 20

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: './backend/package-lock.json'
      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check .

  test:
    name: Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: he_test
          POSTGRES_USER: he_user
          POSTGRES_PASSWORD: he_test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: './backend/package-lock.json'
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://he_user:he_test_password@localhost:5432/he_test
      - run: npm test
        env:
          DATABASE_URL: postgresql://he_user:he_test_password@localhost:5432/he_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-jwt-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  build:
    name: Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: './backend/package-lock.json'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
```

### 9.2 CD — Deploy to Production

```yaml
# .github/workflows/deploy.yml

name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: railway/railway-action@v3
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

      - name: Run Database Migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Notify on Success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text": "✅ Production deploy successful"}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

      - name: Notify on Failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text": "❌ Production deploy failed"}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 10. Git Branching Strategy

```
main                    Production — deployable at all times
  ├── develop           Integration branch — feature work merges here
  │   ├── feat/backend/auth          Auth module (Week 1)
  │   ├── feat/backend/users         User module (Week 2)
  │   ├── feat/backend/roadmaps      Roadmap module (Week 3)
  │   ├── feat/mobile/auth           Flutter auth screens (Week 2)
  │   └── feat/mobile/onboarding     Flutter onboarding (Week 3)
  ├── fix/*             Bug fixes
  ├── chore/*           Tooling, CI/CD, dependencies
  └── release/*         Release candidates (before merge to main)
```

**Rules:**
1. No direct pushes to `main` or `develop`
2. All changes go through PRs with at least 1 approval
3. CI must pass before merge
4. Feature branches are deleted after merge
5. `main` is always deployable

---

## Phase 1 Tasks (Weeks 1–4)

### Task 1: Repository Setup (Days 1–2)

**File Structure Created:**
```
he/
├── .github/workflows/ci.yml
├── .github/workflows/deploy.yml
├── .env.example
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── package.json
├── turbo.json
├── docker-compose.yml
├── README.md
```

**.gitignore:**
```gitignore
node_modules/
dist/
.env
*.log
.turbo/
coverage/
.cache/
```

**.prettierrc:**
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Dependencies:** Git, Node.js 20, Docker Desktop  
**Acceptance Criteria:**
- `git clone` works on a clean machine
- `docker compose up -d` starts PostgreSQL + Redis
- `npm install` at root succeeds
- CI pipeline passes on first PR
- Developer can run full stack in under 10 minutes

**Definition of Done:**
- Repository pushed to GitHub
- Branch protection rules configured on `main` and `develop`
- Docker Compose verified on 2 machines
- CI pipeline green on test PR
- README with setup instructions
- Team members have access and can run locally

---

### Task 2: Prisma Schema + Migrations (Days 2–4)

**File Structure Created:**
```
backend/
├── prisma/
│   ├── schema.prisma         (as above — all models)
│   └── seed.ts               (vocabulary bank seed data)
├── src/common/prisma/
│   └── prisma.service.ts     (Prisma client singleton)
├── src/config/
│   └── config.module.ts      (env validation via @nestjs/config)
```

**Key Files:**

```typescript
// src/common/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// src/config/config.module.ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
}));

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  jwtExpiration: process.env.JWT_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
}));
```

```typescript
// prisma/seed.ts — Minimal vocabulary bank seed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VOCABULARY = [
  { word: 'hello', languageCode: 'en', cefrLevel: 'A1', partOfSpeech: 'interjection',
    definitions: [{ meaning: 'used as a greeting' }],
    examples: [{ sentence: 'Hello, how are you?', translation: '' }] },
  { word: 'goodbye', languageCode: 'en', cefrLevel: 'A1', partOfSpeech: 'interjection',
    definitions: [{ meaning: 'used when leaving' }],
    examples: [{ sentence: 'Goodbye, see you tomorrow.', translation: '' }] },
  { word: 'thank', languageCode: 'en', cefrLevel: 'A1', partOfSpeech: 'verb',
    definitions: [{ meaning: 'express gratitude' }],
    examples: [{ sentence: 'Thank you for your help.', translation: '' }] },
  { word: 'please', languageCode: 'en', cefrLevel: 'A1', partOfSpeech: 'adverb',
    definitions: [{ meaning: 'used to make polite requests' }],
    examples: [{ sentence: 'Please sit down.', translation: '' }] },
  { word: 'yes', languageCode: 'en', cefrLevel: 'A1', partOfSpeech: 'interjection',
    definitions: [{ meaning: 'used to affirm' }],
    examples: [{ sentence: 'Yes, I understand.', translation: '' }] },
  { word: 'no', languageCode: 'en', cefrLevel: 'A1', partOfSpeech: 'interjection',
    definitions: [{ meaning: 'used to negate' }],
    examples: [{ sentence: 'No, I do not know.', translation: '' }] },
];

async function main() {
  for (const word of VOCABULARY) {
    await prisma.vocabularyBank.upsert({
      where: { languageCode_word: { languageCode: word.languageCode, word: word.word } },
      update: {},
      create: word,
    });
  }
  console.log('Vocabulary bank seeded');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Dependencies:** Prisma CLI, PostgreSQL running  
**Acceptance Criteria:**
- `npx prisma migrate dev` creates all tables
- `npx prisma generate` creates TypeScript client
- `npx prisma studio` shows all tables
- `npx ts-node prisma/seed.ts` populates vocabulary bank
- `npx prisma migrate deploy` runs migrations in CI

**Definition of Done:**
- All 16 tables created and verified
- Prisma client generates without errors
- Seed script populates initial vocabulary (6 words minimum)
- Migration committed to git
- Migration tested on clean database

---

### Task 3: Auth Module (Days 3–7)

**File Structure Created:**
```
backend/src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.service.spec.ts
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── refresh-token.dto.ts
│   └── consent.dto.ts
└── strategies/
    ├── jwt.strategy.ts
    ├── jwt-refresh.strategy.ts
    └── google.strategy.ts

backend/src/common/guards/
├── jwt-auth.guard.ts
├── jwt-refresh.guard.ts
└── roles.guard.ts

backend/src/common/decorators/
├── current-user.decorator.ts
├── public.decorator.ts
└── roles.decorator.ts
```

**Implementation Code:**

```typescript
// src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(5)
  @Max(120)
  age: number;

  @ApiProperty({ example: 'IN' })
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  countryCode: string;

  @ApiProperty({ example: 'hi' })
  @IsString()
  @MinLength(2)
  nativeLanguage: string;

  @ApiProperty({ example: 'general' })
  @IsString()
  learningGoal: string;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(5)
  @Max(180)
  dailyStudyMin: number;
}
```

```typescript
// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

```typescript
// src/auth/dto/refresh-token.dto.ts
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
```

```typescript
// src/auth/dto/consent.dto.ts
import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConsentDto {
  @ApiProperty({ description: 'Consent to voice recording' })
  @IsBoolean()
  voiceRecording: boolean;

  @ApiProperty({ description: 'Consent to data processing' })
  @IsBoolean()
  dataProcessing: boolean;
}
```

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { authConfig } from '../../config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  tier: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(authConfig.KEY) auth: ConfigType<typeof authConfig>,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tier: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
```

```typescript
// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Request } from 'express';
import { authConfig } from '../../config/config.module';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(authConfig.KEY) auth: ConfigType<typeof authConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: auth.jwtRefreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    return { ...payload, refreshToken: req.body.refreshToken };
  }
}
```

```typescript
// src/auth/auth.service.ts
import {
  Injectable, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConsentDto } from './dto/consent.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: {
            name: dto.name,
            age: dto.age,
            countryCode: dto.countryCode,
            nativeLanguage: dto.nativeLanguage,
            learningGoal: dto.learningGoal,
            dailyStudyMin: dto.dailyStudyMin,
          },
        },
        languages: {
          create: {
            languageCode: 'en',
            goalCefr: 'B2',
            isPrimary: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        tier: true,
        profile: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.tier);

    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, passwordHash: true, tier: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash!);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.tier);

    // Store refresh token hash
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    return {
      user: { id: user.id, email: user.email, tier: user.tier },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, tier: true, refreshToken: true, isActive: true },
      });

      if (!user || !user.isActive || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Optional: verify stored hash matches (adds DB query but enables revocation)
      // For MVP, skip this check (7-day tokens with logout revocation is sufficient)

      const tokens = await this.generateTokens(user.id, user.email, user.tier);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async grantConsent(userId: string, dto: ConsentDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        consentGranted: dto.voiceRecording,
        consentGrantedAt: dto.voiceRecording ? new Date() : null,
      },
    });

    // Log consent
    await this.prisma.consentLog.create({
      data: {
        userId,
        consentType: 'voice_recording',
        granted: dto.voiceRecording,
      },
    });

    await this.prisma.consentLog.create({
      data: {
        userId,
        consentType: 'data_processing',
        granted: dto.dataProcessing,
      },
    });

    return { consentGranted: user.consentGranted };
  }

  private async generateTokens(userId: string, email: string, tier: string) {
    const payload = { sub: userId, email, tier };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_EXPIRATION || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
```

```typescript
// src/auth/auth.controller.ts
import {
  Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConsentDto } from './dto/consent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@CurrentUser('id') userId: string) {
    await this.authService.logout(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Grant or revoke consent for voice recording and data processing' })
  async consent(@CurrentUser('id') userId: string, @Body() dto: ConsentDto) {
    return this.authService.grantConsent(userId, dto);
  }
}
```

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigType } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { authConfig } from '../config/config.module';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: ConfigType<typeof authConfig>) => ({
        secret: auth.jwtSecret,
        signOptions: { expiresIn: auth.jwtExpiration },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// src/common/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

```typescript
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

**Dependencies:** PrismaService, JwtModule, PassportModule, bcrypt  
**Acceptance Criteria:**
- `POST /v1/auth/register` creates user + profile + returns JWT tokens
- `POST /v1/auth/login` validates credentials + returns tokens
- `POST /v1/auth/refresh` issues new tokens
- `POST /v1/auth/logout` invalidates refresh token
- `POST /v1/auth/consent` stores consent + logs to consent_logs
- Protected routes return 401 without valid JWT
- Password hashed with bcrypt (cost 12)
- All errors return consistent `{ error: { code, message } }` format

**Definition of Done:**
- All auth endpoints working and tested (unit + e2e)
- JWT strategy validates tokens on protected routes
- Refresh token rotation implemented
- Consent flow logged to database
- OpenAPI docs generated via @nestjs/swagger
- Rate limiting configured (5/min register, 10/min login)
- 401 errors handled globally

---

### Task 4: Users Module (Days 5–8)

**File Structure Created:**
```
backend/src/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
├── users.service.spec.ts
└── dto/
    ├── update-profile.dto.ts
    └── update-preferences.dto.ts
```

```typescript
// src/users/dto/update-profile.dto.ts
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  learningGoal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  dailyStudyMin?: number;
}
```

```typescript
// src/users/dto/update-preferences.dto.ts
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['friendly', 'professional'] })
  @IsOptional()
  @IsString()
  teacherMode?: string;

  @ApiPropertyOptional({ enum: ['visual', 'auditory', 'reading', 'mixed'] })
  @IsOptional()
  @IsString()
  learningStyle?: string;
}
```

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tier: true,
        consentGranted: true,
        createdAt: true,
        profile: true,
        languages: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.userProfile.update({
      where: { userId },
      data: dto,
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.userProfile.update({
      where: { userId },
      data: dto,
    });
  }

  async deleteAccount(userId: string) {
    // Cascading delete via Prisma (onDelete: Cascade on all relations)
    // S3 audio cleanup is handled separately by a background job
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        languages: true,
        dailyActivity: true,
        errorCorrections: { take: 100, orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            assessments: true,
            lessonsProgress: true,
            conversationSessions: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
```

```typescript
// src/users/users.controller.ts
import {
  Controller, Get, Put, Delete, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('me/profile')
  @ApiOperation({ summary: 'Update profile' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update learning preferences' })
  async updatePreferences(@CurrentUser('id') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(userId, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account (GDPR right to erasure)' })
  async deleteAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export all user data (GDPR data portability)' })
  async exportData(@CurrentUser('id') userId: string) {
    return this.usersService.exportData(userId);
  }
}
```

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

**Dependencies:** PrismaService, JwtAuthGuard  
**Acceptance Criteria:**
- `GET /v1/users/me` returns user with profile and languages
- `PUT /v1/users/me/profile` updates profile fields
- `PUT /v1/users/me/preferences` updates preferences
- `DELETE /v1/users/me` deletes user and cascades
- `GET /v1/users/me/export` returns JSON with all user data
- All endpoints return 401 without JWT
- Profile returned after registration (from auth flow)

**Definition of Done:**
- All user endpoints working and tested
- GDPR data export returns proper JSON structure
- Account deletion cascades through all relations
- Preferences persist and return correctly
- Profile update validates fields

---

### Task 5: Roadmaps Module (Days 7–10)

**File Structure Created:**
```
backend/src/roadmaps/
├── roadmaps.module.ts
├── roadmaps.controller.ts
├── roadmaps.service.ts
├── roadmaps.service.spec.ts
└── dto/
    └── create-roadmap.dto.ts
```

```typescript
// src/roadmaps/dto/create-roadmap.dto.ts
import { IsString, IsInt, IsIn, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoadmapDto {
  @ApiProperty({ enum: ['3', '6', '12'] })
  @IsInt()
  @Min(3)
  @Max(12)
  durationMonths: number;

  @ApiProperty({ example: 'A1' })
  @IsString()
  currentCefr: string;

  @ApiProperty({ example: 'B2' })
  @IsString()
  targetCefr: string;
}
```

```typescript
// src/roadmaps/roadmaps.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';

@Injectable()
export class RoadmapsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoadmapDto) {
    const existing = await this.prisma.roadmap.findFirst({
      where: { userId, isActive: true },
    });

    if (existing) {
      throw new BadRequestException('Active roadmap already exists');
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + dto.durationMonths);

    const roadmap = await this.prisma.roadmap.create({
      data: {
        userId,
        languageCode: 'en',
        durationMonths: dto.durationMonths,
        startDate: now,
        endDate,
        currentCefr: dto.currentCefr,
        targetCefr: dto.targetCefr,
        milestones: {
          create: this.generateMilestones(dto.durationMonths, dto.currentCefr, dto.targetCefr),
        },
      },
      include: {
        milestones: { orderBy: { monthNumber: 'asc' } },
      },
    });

    return roadmap;
  }

  async getActive(userId: string) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { userId, isActive: true },
      include: {
        milestones: { orderBy: { monthNumber: 'asc' } },
      },
    });

    if (!roadmap) throw new NotFoundException('No active roadmap');
    return roadmap;
  }

  async getGoals(userId: string, roadmapId: string) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { id: roadmapId, userId },
      include: {
        milestones: {
          orderBy: { monthNumber: 'asc' },
          where: { monthNumber: { lte: 3 } }, // Current quarter
        },
      },
    });

    if (!roadmap) throw new NotFoundException('Roadmap not found');
    return roadmap;
  }

  async getTodayPlan(userId: string) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { userId, isActive: true },
      include: {
        milestones: {
          orderBy: { monthNumber: 'asc' },
          take: 1,
        },
      },
    });

    if (!roadmap) {
      return { needsRoadmap: true, message: 'Complete placement test to get your roadmap' };
    }

    // Today's plan will be enriched by the LearningModule in Phase 2
    return {
      roadmap: {
        id: roadmap.id,
        currentCefr: roadmap.currentCefr,
        targetCefr: roadmap.targetCefr,
        currentMilestone: roadmap.milestones[0],
      },
      lesson: null, // Generated by LearningModule in Phase 2
    };
  }

  private generateMilestones(durationMonths: number, from: string, to: string) {
    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const fromIndex = cefrLevels.indexOf(from);
    const toIndex = cefrLevels.indexOf(to);
    const levelsToGain = toIndex - fromIndex;
    const milestonesPerMonth = Math.max(1, Math.ceil(levelsToGain / durationMonths));

    const milestones = [];
    let currentLevelIndex = fromIndex;

    for (let month = 1; month <= durationMonths; month++) {
      const title = this.getMilestoneTitle(cefrLevels[currentLevelIndex], month);
      milestones.push({
        monthNumber: month,
        title,
        description: `Focus on ${cefrLevels[currentLevelIndex]} level skills: vocabulary, grammar, speaking, and listening.`,
        sortOrder: month,
      });

      if (month % Math.ceil(durationMonths / levelsToGain) === 0 && currentLevelIndex < toIndex) {
        currentLevelIndex++;
      }
    }

    return milestones;
  }

  private getMilestoneTitle(level: string, month: number): string {
    const titles: Record<string, string[]> = {
      A1: ['Foundations: Greetings & Introductions', 'Basic Conversations', 'Daily Routines'],
      A2: ['Expanding Vocabulary', 'Past & Future Tenses', 'Making Requests'],
      B1: ['Complex Sentences', 'Opinions & Arguments', 'Narrative Skills'],
      B2: ['Fluency Building', 'Abstract Concepts', 'Professional Language'],
    };
    const levelTitles = titles[level] || [`${level} Level Progress`];
    return levelTitles[Math.min(month - 1, levelTitles.length - 1)];
  }
}
```

```typescript
// src/roadmaps/roadmaps.controller.ts
import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoadmapsService } from './roadmaps.service';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Roadmaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/roadmaps')
export class RoadmapsController {
  constructor(private roadmapsService: RoadmapsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new learning roadmap' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateRoadmapDto) {
    return this.roadmapsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get active roadmap' })
  async getActive(@CurrentUser('id') userId: string) {
    return this.roadmapsService.getActive(userId);
  }

  @Get(':id/goals')
  @ApiOperation({ summary: 'Get roadmap goals for current quarter' })
  async getGoals(
    @CurrentUser('id') userId: string,
    @Param('id') roadmapId: string,
  ) {
    return this.roadmapsService.getGoals(userId, roadmapId);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's learning plan" })
  async getTodayPlan(@CurrentUser('id') userId: string) {
    return this.roadmapsService.getTodayPlan(userId);
  }
}
```

```typescript
// src/roadmaps/roadmaps.module.ts
import { Module } from '@nestjs/common';
import { RoadmapsController } from './roadmaps.controller';
import { RoadmapsService } from './roadmaps.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RoadmapsController],
  providers: [RoadmapsService],
  exports: [RoadmapsService],
})
export class RoadmapsModule {}
```

**Dependencies:** PrismaService, JwtAuthGuard  
**Acceptance Criteria:**
- `POST /v1/roadmaps` creates roadmap with milestones
- `GET /v1/roadmaps` returns active roadmap
- `GET /v1/roadmaps/{id}/goals` returns milestones
- `GET /v1/roadmaps/today` returns plan (or prompts placement test)
- Duplicate active roadmap creation rejected
- Milestones generated correctly for 3/6/12 month durations

**Definition of Done:**
- All roadmap endpoints working and tested
- Milestones auto-generated from CEFR levels
- Duplicate roadmap prevention works
- Today's plan returns structured response
- Roadmap creation validates duration and CEFR values

---

### Task 6: Common Infrastructure (Days 1–10, Parallel)

**File Structure Created:**
```
backend/src/
├── common/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── request-id.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       ├── jwt-refresh.guard.ts
│       └── roles.guard.ts
├── config/
│   └── config.module.ts
├── app.module.ts
└── main.ts
```

```typescript
// src/common/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// src/common/interceptors/request-id.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Request, Response } from 'express';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const requestId = uuid();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    return next.handle();
  }
}
```

```typescript
// src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(JSON.stringify({
          method,
          url,
          duration,
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        }));
      }),
    );
  }
}
```

```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorBody = {
      error: {
        code: status,
        message: typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message,
        requestId: request.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.warn(JSON.stringify({
      status,
      path: request.url,
      method: request.method,
      requestId: request.headers['x-request-id'],
      message: errorBody.error.message,
    }));

    response.status(status).json(errorBody);
  }
}
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoadmapsModule } from './roadmaps/roadmaps.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { appConfig, authConfig } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RoadmapsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS — allow Flutter app in development
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://he-app.com']
      : ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('HE API')
    .setDescription('AI-powered language learning API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
```

**Dependencies:** @nestjs/config, @nestjs/swagger, uuid  
**Acceptance Criteria:**
- Server starts on port 3000
- Swagger docs available at `/docs`
- All responses include `X-Request-Id` header
- Validation errors return consistent format
- Unknown properties stripped from request bodies
- CORS configured for Flutter client

**Definition of Done:**
- Server starts cleanly
- Swagger UI renders all endpoints
- Request ID on every response
- Validation pipe working (test with invalid input)
- Error filter returns consistent shape
- CORS allows Flutter requests

---

### Task 7: Flutter Scaffold + Auth Screens (Days 8–14)

**File Structure Created:**
```
mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── core/
│   │   ├── api/
│   │   │   ├── api_client.dart
│   │   │   └── api_exceptions.dart
│   │   ├── theme/
│   │   │   ├── app_theme.dart
│   │   │   └── colors.dart
│   │   └── storage/
│   │       └── secure_storage.dart
│   └── features/
│       └── auth/
│           ├── data/
│           │   ├── auth_repository.dart
│           │   └── auth_api.dart
│           ├── bloc/
│           │   ├── auth_bloc.dart
│           │   ├── auth_event.dart
│           │   └── auth_state.dart
│           └── screens/
│               ├── login_screen.dart
│               ├── register_screen.dart
│               └── onboarding_screen.dart
├── test/
├── pubspec.yaml
└── analysis_options.yaml
```

```dart
// lib/core/api/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiClient({required String baseUrl}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Attempt token refresh
          final refreshed = await _tryRefresh();
          if (refreshed) {
            // Retry original request
            final retryOptions = error.requestOptions;
            final token = await _storage.read(key: 'access_token');
            retryOptions.headers['Authorization'] = 'Bearer $token';
            final response = await _dio.fetch(retryOptions);
            handler.resolve(response);
            return;
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<bool> _tryRefresh() async {
    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) return false;

      final response = await Dio().post(
        '${_dio.options.baseUrl}/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      await _storage.write(key: 'access_token', value: response.data['accessToken']);
      await _storage.write(key: 'refresh_token', value: response.data['refreshToken']);
      return true;
    } catch {
      await _storage.deleteAll();
      return false;
    }
  }

  Future<Response> get(String path, {Map<String, dynamic>? query}) =>
      _dio.get(path, queryParameters: query);

  Future<Response> post(String path, {dynamic data}) =>
      _dio.post(path, data: data);

  Future<Response> put(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  Future<Response> delete(String path) =>
      _dio.delete(path);
}
```

```dart
// lib/features/auth/data/auth_api.dart
import '../../../core/api/api_client.dart';

class AuthApi {
  final ApiClient _client;

  AuthApi(this._client);

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String name,
    required int age,
    required String countryCode,
    required String nativeLanguage,
    required String learningGoal,
    required int dailyStudyMin,
  }) async {
    final response = await _client.post('/v1/auth/register', data: {
      'email': email,
      'password': password,
      'name': name,
      'age': age,
      'countryCode': countryCode,
      'nativeLanguage': nativeLanguage,
      'learningGoal': learningGoal,
      'dailyStudyMin': dailyStudyMin,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await _client.post('/v1/auth/login', data: {
      'email': email,
      'password': password,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> refresh(String refreshToken) async {
    final response = await _client.post('/v1/auth/refresh', data: {
      'refreshToken': refreshToken,
    });
    return response.data;
  }

  Future<void> logout() async {
    await _client.post('/v1/auth/logout');
  }

  Future<Map<String, dynamic>> grantConsent({
    required bool voiceRecording,
    required bool dataProcessing,
  }) async {
    final response = await _client.post('/v1/auth/consent', data: {
      'voiceRecording': voiceRecording,
      'dataProcessing': dataProcessing,
    });
    return response.data;
  }
}
```

```dart
// lib/features/auth/data/auth_repository.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'auth_api.dart';

class AuthRepository {
  final AuthApi _api;
  final FlutterSecureStorage _storage;

  AuthRepository(this._api, this._storage);

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String name,
    required int age,
    required String countryCode,
    required String nativeLanguage,
    required String learningGoal,
    required int dailyStudyMin,
  }) async {
    final result = await _api.register(
      email: email,
      password: password,
      name: name,
      age: age,
      countryCode: countryCode,
      nativeLanguage: nativeLanguage,
      learningGoal: learningGoal,
      dailyStudyMin: dailyStudyMin,
    );
    await _storeTokens(result['accessToken'], result['refreshToken']);
    return result['user'];
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final result = await _api.login(email: email, password: password);
    await _storeTokens(result['accessToken'], result['refreshToken']);
    return result['user'];
  }

  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {
      // Ignore API error on logout
    }
    await _storage.deleteAll();
  }

  Future<void> grantConsent({
    required bool voiceRecording,
    required bool dataProcessing,
  }) async {
    await _api.grantConsent(
      voiceRecording: voiceRecording,
      dataProcessing: dataProcessing,
    );
  }

  Future<void> _storeTokens(String? access, String? refresh) async {
    if (access != null) {
      await _storage.write(key: 'access_token', value: access);
    }
    if (refresh != null) {
      await _storage.write(key: 'refresh_token', value: refresh);
    }
  }
}
```

```dart
// lib/features/auth/bloc/auth_event.dart
import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class LoginSubmitted extends AuthEvent {
  final String email;
  final String password;

  const LoginSubmitted(this.email, this.password);

  @override
  List<Object?> get props => [email, password];
}

class RegisterSubmitted extends AuthEvent {
  final String email;
  final String password;
  final String name;
  final int age;
  final String countryCode;
  final String nativeLanguage;
  final String learningGoal;
  final int dailyStudyMin;

  const RegisterSubmitted({
    required this.email,
    required this.password,
    required this.name,
    required this.age,
    required this.countryCode,
    required this.nativeLanguage,
    required this.learningGoal,
    required this.dailyStudyMin,
  });

  @override
  List<Object?> get props => [
    email, password, name, age, countryCode,
    nativeLanguage, learningGoal, dailyStudyMin,
  ];
}

class ConsentSubmitted extends AuthEvent {
  final bool voiceRecording;
  final bool dataProcessing;

  const ConsentSubmitted(this.voiceRecording, this.dataProcessing);

  @override
  List<Object?> get props => [voiceRecording, dataProcessing];
}

class LogoutRequested extends AuthEvent {}

class AuthCheckRequested extends AuthEvent {}
```

```dart
// lib/features/auth/bloc/auth_state.dart
import 'package:equatable/equatable.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class Authenticated extends AuthState {
  final Map<String, dynamic> user;

  const Authenticated(this.user);

  @override
  List<Object?> get props => [user];
}

class ConsentRequired extends AuthState {
  final Map<String, dynamic> user;

  const ConsentRequired(this.user);

  @override
  List<Object?> get props => [user];
}

class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

class AuthUnauthenticated extends AuthState {}
```

```dart
// lib/features/auth/bloc/auth_bloc.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import 'auth_event.dart';
import 'auth_state.dart';
import '../data/auth_repository.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _repository;

  AuthBloc(this._repository) : super(AuthInitial()) {
    on<AuthCheckRequested>(_onCheckAuth);
    on<LoginSubmitted>(_onLogin);
    on<RegisterSubmitted>(_onRegister);
    on<ConsentSubmitted>(_onConsent);
    on<LogoutRequested>(_onLogout);
  }

  Future<void> _onCheckAuth(AuthCheckRequested event, Emitter<AuthState> emit) async {
    final loggedIn = await _repository.isLoggedIn();
    if (loggedIn) {
      emit(const Authenticated({}));
    } else {
      emit(AuthUnauthenticated());
    }
  }

  Future<void> _onLogin(LoginSubmitted event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await _repository.login(
        email: event.email,
        password: event.password,
      );
      emit(Authenticated(user));
    } catch (e) {
      emit(AuthError('Login failed: ${e.toString()}'));
    }
  }

  Future<void> _onRegister(RegisterSubmitted event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await _repository.register(
        email: event.email,
        password: event.password,
        name: event.name,
        age: event.age,
        countryCode: event.countryCode,
        nativeLanguage: event.nativeLanguage,
        learningGoal: event.learningGoal,
        dailyStudyMin: event.dailyStudyMin,
      );
      emit(ConsentRequired(user));
    } catch (e) {
      emit(AuthError('Registration failed: ${e.toString()}'));
    }
  }

  Future<void> _onConsent(ConsentSubmitted event, Emitter<AuthState> emit) async {
    try {
      await _repository.grantConsent(
        voiceRecording: event.voiceRecording,
        dataProcessing: event.dataProcessing,
      );
      // Transition to authenticated with consent
      final current = state;
      if (current is ConsentRequired) {
        emit(Authenticated(current.user));
      }
    } catch (e) {
      emit(AuthError('Consent failed: ${e.toString()}'));
    }
  }

  Future<void> _onLogout(LogoutRequested event, Emitter<AuthState> emit) async {
    await _repository.logout();
    emit(AuthUnauthenticated());
  }
}
```

**Dependencies:** flutter_bloc, dio, flutter_secure_storage, go_router  
**Acceptance Criteria:**
- App launches and checks auth state
- Login screen accepts email + password, navigates to home
- Register screen creates account, shows consent screen
- Consent screen collects permissions, navigates to home
- Token refresh works automatically on 401
- Logout clears tokens and returns to login
- Secure storage persists tokens across app restarts

**Definition of Done:**
- Auth flow complete: Register → Consent → Home
- Login flow complete: Login → Home
- Token refresh works on expired access token
- Logout clears all stored data
- Error states handled gracefully (show snackbar)
- Loading states shown during API calls
- Routes protected: unauthenticated → login screen

---

### Task 8: Infrastructure Setup (Days 1–5, Parallel)

**File Structure Created:**
```
infra/
├── docker/
│   └── backend.Dockerfile
└── scripts/
    ├── setup.sh
    └── seed.sh
```

```bash
# infra/scripts/setup.sh
#!/bin/bash
set -e

echo "=== HE Platform Setup ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx required"; exit 1; }

# Install dependencies
echo "→ Installing backend dependencies..."
cd backend
npm install

# Generate Prisma client
echo "→ Generating Prisma client..."
npx prisma generate

# Start infrastructure
echo "→ Starting PostgreSQL + Redis..."
docker compose up -d postgres redis

# Wait for database
echo "→ Waiting for database..."
until docker compose exec postgres pg_isready -U he_user -d he_dev; do
  sleep 2
done

# Run migrations
echo "→ Running database migrations..."
npx prisma migrate dev --name init

# Seed data
echo "→ Seeding initial data..."
npx ts-node prisma/seed.ts

echo ""
echo "=== Setup Complete ==="
echo "Backend: http://localhost:3000"
echo "Swagger: http://localhost:3000/docs"
echo "Prisma Studio: npx prisma studio"
echo "Start backend: cd backend && npm run start:dev"
```

```bash
# infra/scripts/seed.sh
#!/bin/bash
set -e
cd backend
npx ts-node prisma/seed.ts
```

```yaml
# infra/docker/backend.Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

USER nestjs
EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "dist/main"]
```

**Dependencies:** Docker, Node.js 20, Railway/Render account  
**Acceptance Criteria:**
- `docker compose up` starts all services
- `setup.sh` completes without errors on clean machine
- Production Dockerfile builds without errors
- Railway/Render deploys from `main` branch
- Health endpoint returns 200 on deployed instance

**Definition of Done:**
- Local dev environment starts in < 5 commands
- Production Dockerfile builds and runs
- CI pipeline deploys to staging on PR merge to develop
- CD pipeline deploys to production on merge to main
- Health check endpoint configured
- Environment variables configured in Railway/Render

---

## Week-by-Week Schedule

```
Week 1 (Days 1-5):
  Day 1:   Repo init, Git setup, CI/CD config, Docker Compose
  Day 2:   Prisma schema + first migration
  Day 3:   NestJS scaffold + PrismaService + ConfigModule
  Day 4:   Auth module — register + login endpoints
  Day 5:   Auth module — refresh + logout + JWT guards

Week 2 (Days 6-10):
  Day 6:   Users module — profile CRUD
  Day 7:   Users module — GDPR endpoints (delete + export)
  Day 8:   Roadmaps module — create + milestones
  Day 9:   Roadmaps module — get + today plan
  Day 10:  Common infra — error filter, interceptors, Swagger

Week 3 (Days 11-15):
  Day 11:  Flutter scaffold — project init + theme + ApiClient
  Day 12:  Flutter auth — login screen + bloc
  Day 13:  Flutter auth — register screen
  Day 14:  Flutter auth — consent screen
  Day 15:  Flutter routing + auth state management

Week 4 (Days 16-20):
  Day 16:  Flutter onboarding flow integration
  Day 17:  Integration tests — backend e2e
  Day 18:  Integration tests — mobile + backend
  Day 19:  Staging deployment + environment verification
  Day 20:  Bug fixes + polish + Phase 1 sign-off
```

---

## Phase 1 Sign-off Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Repository initialized with CI/CD | ☐ |
| 2 | Docker Compose starts PostgreSQL + Redis | ☐ |
| 3 | Prisma schema migrated (all 16+ tables) | ☐ |
| 4 | Register endpoint creates user + profile | ☐ |
| 5 | Login returns JWT tokens | ☐ |
| 6 | Refresh token issues new tokens | ☐ |
| 7 | Logout invalidates refresh token | ☐ |
| 8 | Consent flow stores to consent_logs | ☐ |
| 9 | Profile CRUD works | ☐ |
| 10 | Account deletion cascades | ☐ |
| 11 | Data export returns complete JSON | ☐ |
| 12 | Roadmap creation generates milestones | ☐ |
| 13 | Today's plan endpoint responds | ☐ |
| 14 | All responses have X-Request-Id | ☐ |
| 15 | Error responses follow consistent format | ☐ |
| 16 | Swagger docs render all endpoints | ☐ |
| 17 | Flutter app launches and checks auth | ☐ |
| 18 | Flutter login + register flow works | ☐ |
| 19 | Flutter consent screen collects permissions | ☐ |
| 20 | Token refresh works on 401 | ☐ |
| 21 | Staging environment deployed | ☐ |
| 22 | All unit tests pass (coverage > 70%) | ☐ |
| 23 | All e2e tests pass | ☐ |
| 24 | Setup verified on 2nd developer machine | ☐ |

---

## End of Phase 1 Foundation
