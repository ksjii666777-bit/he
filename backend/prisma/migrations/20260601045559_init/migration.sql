-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('email', 'google');

-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('free', 'premium');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('voice_recording', 'data_processing', 'marketing');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'email',
    "auth_provider_id" TEXT,
    "tier" "UserTier" NOT NULL DEFAULT 'free',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "consent_granted" BOOLEAN NOT NULL DEFAULT false,
    "consent_granted_at" TIMESTAMP(3),
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "country_code" TEXT NOT NULL,
    "native_language" TEXT NOT NULL,
    "learning_goal" TEXT NOT NULL,
    "daily_study_min" INTEGER NOT NULL DEFAULT 15,
    "learning_style" TEXT NOT NULL DEFAULT 'mixed',
    "teacher_mode" TEXT NOT NULL DEFAULT 'friendly',
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_languages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "goal_cefr" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "overall_score" DECIMAL(5,2),
    "overall_cefr" TEXT,
    "content" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "section_type" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "user_response" JSONB,
    "is_correct" BOOLEAN,
    "score" DECIMAL(5,2),
    "ai_feedback" TEXT,
    "audio_url" TEXT,
    "response_time_ms" INTEGER,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmaps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "current_cefr" TEXT NOT NULL,
    "target_cefr" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_milestones" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "month_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "roadmap_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "cefr_level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" DECIMAL(5,2),
    "time_spent_sec" INTEGER NOT NULL DEFAULT 0,
    "exercises_total" INTEGER NOT NULL DEFAULT 0,
    "exercises_completed" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB,
    "weak_areas" TEXT[],
    "vocabulary_learned" TEXT[],
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_bank" (
    "id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "transliteration" TEXT,
    "phonetic" TEXT,
    "part_of_speech" TEXT,
    "cefr_level" TEXT,
    "frequency_rank" INTEGER,
    "definitions" JSONB,
    "examples" JSONB,
    "synonyms" TEXT[],
    "common_mistakes" JSONB,
    "audio_url" TEXT,
    "topic_tags" TEXT[],

    CONSTRAINT "vocabulary_bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vocabulary" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "familiarity" INTEGER NOT NULL DEFAULT 0,
    "timesSeen" INTEGER NOT NULL DEFAULT 0,
    "times_correct" INTEGER NOT NULL DEFAULT 0,
    "times_wrong" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interval_sec" BIGINT NOT NULL DEFAULT 0,
    "ease_factor" DECIMAL(4,2) NOT NULL DEFAULT 2.50,

    CONSTRAINT "user_vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speech_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_type" TEXT NOT NULL,
    "reference_id" UUID,
    "language_code" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "audio_url" TEXT NOT NULL,
    "transcription_text" TEXT,
    "transcription_conf" DECIMAL(4,3),
    "noise_level_db" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'processing',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speech_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pronunciation_analysis" (
    "id" UUID NOT NULL,
    "speech_session_id" UUID NOT NULL,
    "overall_score" DECIMAL(5,2) NOT NULL,
    "fluency_score" DECIMAL(5,2),
    "grammar_score" DECIMAL(5,2),
    "confidence_score" DECIMAL(5,2),
    "phoneme_scores" JSONB,
    "prosody_metrics" JSONB,
    "errors_detected" JSONB,
    "l1_influences" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pronunciation_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "scenario" TEXT NOT NULL,
    "duration_ms" BIGINT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sender" TEXT NOT NULL,
    "message_order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "audio_url" TEXT,
    "transcription" TEXT,
    "corrections" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_corrections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" UUID,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "incorrect_text" TEXT NOT NULL,
    "correct_text" TEXT NOT NULL,
    "explanation" TEXT,
    "alternatives" TEXT[],
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "lessons_completed" INTEGER NOT NULL DEFAULT 0,
    "exercises_done" INTEGER NOT NULL DEFAULT 0,
    "vocab_reviewed" INTEGER NOT NULL DEFAULT 0,
    "conversations_had" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DECIMAL(5,2),
    "streak_day" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_outputs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "prompt_type" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_cents" DECIMAL(8,4),
    "latency_ms" INTEGER,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "validation_status" TEXT,
    "passed_safety" BOOLEAN NOT NULL DEFAULT false,
    "was_fallback" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "page" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_output_flags" (
    "id" UUID NOT NULL,
    "ai_output_id" UUID NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_output_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_languages_user_id_language_code_key" ON "user_languages"("user_id", "language_code");

-- CreateIndex
CREATE INDEX "consent_logs_user_id_consent_type_idx" ON "consent_logs"("user_id", "consent_type");

-- CreateIndex
CREATE INDEX "assessments_user_id_created_at_idx" ON "assessments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "assessment_responses_assessment_id_idx" ON "assessment_responses"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "roadmaps_user_id_key" ON "roadmaps"("user_id");

-- CreateIndex
CREATE INDEX "roadmaps_user_id_language_code_idx" ON "roadmaps"("user_id", "language_code");

-- CreateIndex
CREATE INDEX "roadmap_milestones_roadmap_id_idx" ON "roadmap_milestones"("roadmap_id");

-- CreateIndex
CREATE INDEX "lessons_progress_user_id_lesson_date_idx" ON "lessons_progress"("user_id", "lesson_date");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_progress_user_id_lesson_date_key" ON "lessons_progress"("user_id", "lesson_date");

-- CreateIndex
CREATE INDEX "vocabulary_bank_language_code_cefr_level_idx" ON "vocabulary_bank"("language_code", "cefr_level");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_bank_language_code_word_key" ON "vocabulary_bank"("language_code", "word");

-- CreateIndex
CREATE INDEX "user_vocabulary_user_id_next_review_at_idx" ON "user_vocabulary"("user_id", "next_review_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_vocabulary_user_id_vocabulary_id_key" ON "user_vocabulary"("user_id", "vocabulary_id");

-- CreateIndex
CREATE INDEX "speech_sessions_user_id_created_at_idx" ON "speech_sessions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pronunciation_analysis_speech_session_id_key" ON "pronunciation_analysis"("speech_session_id");

-- CreateIndex
CREATE INDEX "conversation_messages_session_id_message_order_idx" ON "conversation_messages"("session_id", "message_order");

-- CreateIndex
CREATE INDEX "error_corrections_user_id_language_code_created_at_idx" ON "error_corrections"("user_id", "language_code", "created_at");

-- CreateIndex
CREATE INDEX "daily_activity_user_id_date_idx" ON "daily_activity"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_user_id_date_key" ON "daily_activity"("user_id", "date");

-- CreateIndex
CREATE INDEX "ai_outputs_user_id_created_at_idx" ON "ai_outputs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "ai_output_flags_reviewed_at_idx" ON "ai_output_flags"("reviewed_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_languages" ADD CONSTRAINT "user_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_milestones" ADD CONSTRAINT "roadmap_milestones_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_progress" ADD CONSTRAINT "lessons_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary" ADD CONSTRAINT "user_vocabulary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary" ADD CONSTRAINT "user_vocabulary_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabulary_bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_sessions" ADD CONSTRAINT "speech_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_analysis" ADD CONSTRAINT "pronunciation_analysis_speech_session_id_fkey" FOREIGN KEY ("speech_session_id") REFERENCES "speech_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_corrections" ADD CONSTRAINT "error_corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_output_flags" ADD CONSTRAINT "ai_output_flags_ai_output_id_fkey" FOREIGN KEY ("ai_output_id") REFERENCES "ai_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_output_flags" ADD CONSTRAINT "ai_output_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
