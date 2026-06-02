-- CreateTable
CREATE TABLE "grammar_lessons" (
    "id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "cefr_level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "grammar_point" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "short_explanation" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "examples" JSONB,
    "rules" TEXT[],
    "exceptions" TEXT[],
    "common_mistakes" JSONB,
    "related_lessons" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_scenarios" (
    "id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "cefr_level" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "context" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "roles" JSONB,
    "vocabulary" TEXT[],
    "phrases" TEXT[],
    "tips" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grammar_lessons_language_code_cefr_level_idx" ON "grammar_lessons"("language_code", "cefr_level");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_lessons_language_code_grammar_point_key" ON "grammar_lessons"("language_code", "grammar_point");

-- CreateIndex
CREATE INDEX "conversation_scenarios_language_code_cefr_level_idx" ON "conversation_scenarios"("language_code", "cefr_level");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_scenarios_language_code_scenario_key" ON "conversation_scenarios"("language_code", "scenario");
