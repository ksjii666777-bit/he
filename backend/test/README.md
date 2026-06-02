# Test Suite — HE Backend

## Directory Structure

```
test/
├── e2e/
│   ├── user-journey.e2e-spec.ts       # Full 8-step user journey
│   └── module-integration.e2e-spec.ts # Cross-module integration
├── load/
│   ├── auth-load.js                   # Auth endpoint load test (100 VUs)
│   ├── lesson-load.js                 # Lesson generation load test (20 VUs)
│   └── mixed-workload.js             # Mixed workload test (25 VUs)
├── cost/
│   ├── cost-guard.spec.ts             # CostGuard unit tests
│   └── cost-model-validation.ts       # Cost projection validator
├── quality/
│   ├── lesson-quality.spec.ts         # Lesson evaluation rubric tests
│   ├── conversation-quality.spec.ts   # Conversation evaluation rubric tests
│   └── pronunciation-quality.spec.ts  # Pronunciation evaluation rubric tests
├── recovery/
│   ├── model-router-recovery.spec.ts  # Circuit breaker, retry, fallback
│   ├── content-validator-recovery.spec.ts # Malformed input, safety filter
│   └── speech-recovery.spec.ts        # Missing API keys, edge cases
├── datasets/
│   ├── lesson-test-cases.ts           # 4 lesson test cases per CEFR/lang
│   ├── conversation-test-cases.ts     # 5 conversation scenarios
│   └── pronunciation-test-cases.ts    # 4 pronunciation difficulty levels
├── rubrics/
│   ├── lesson-quality-rubric.ts       # Lesson quality scoring
│   ├── conversation-quality-rubric.ts # Conversation quality scoring
│   └── pronunciation-quality-rubric.ts # Pronunciation quality scoring
└── production-readiness-checklist.md  # Go/no-go checklist
```

## Running Tests

```bash
# All unit tests
npm test

# E2E tests (requires running DB)
npm run test:e2e

# Specific test files
npx jest test/cost/cost-guard.spec.ts
npx jest test/quality/lesson-quality.spec.ts
npx jest test/recovery/model-router-recovery.spec.ts
```

## Load Tests (K6)

```bash
# Auth load test
k6 run test/load/auth-load.js

# Lesson generation load test
k6 run test/load/lesson-load.js

# Mixed workload test
k6 run test/load/mixed-workload.js
```

## Cost Validation

```bash
# Validate cost model against budget
npx ts-node test/cost/cost-model-validation.ts
```

## Evaluation Rubrics

Each rubric scores content on 0-100 scale across multiple dimensions:

| Rubric | Dimensions | Pass Threshold |
|--------|-----------|----------------|
| Lesson | exerciseVariety, cefrAlignment, contentQuality, instructionClarity | Overall >= 70 |
| Conversation | relevance, grammarHelpfulness, encouragementLevel | Overall >= 70 |
| Pronunciation | accuracy, completeness, feedbackRelevance | Overall >= 60 |
