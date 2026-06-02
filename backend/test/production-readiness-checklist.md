# Production Readiness Checklist

## 1. Functional Completeness

| # | Check | Criteria | Status | Notes |
|---|-------|----------|--------|-------|
| 1.1 | User Registration | New user can register with email/password + profile | ☐ | |
| 1.2 | JWT Auth | Login returns access + refresh tokens; refresh works | ☐ | |
| 1.3 | Consent | User grants voice/data processing consent | ☐ | |
| 1.4 | Placement Test | 15-25 questions generated; CEFR level returned | ☐ | |
| 1.5 | Roadmap | Milestone-based roadmap created; today plan accessible | ☐ | |
| 1.6 | Lesson Generation | AI generates lesson with 4-8 exercises | ☐ | |
| 1.7 | Answer Checking | Per-exercise + batch submission works | ☐ | |
| 1.8 | WebSocket Conversation | Connect, start, message, end with AI | ☐ | |
| 1.9 | Message Dedup | Same messageId processed only once | ☐ | |
| 1.10 | Pronunciation Scoring | Reference vs spoken text returns score + feedback | ☐ | |
| 1.11 | TTS Synthesis | Text-to-speech returns WAV audio | ☐ | |
| 1.12 | Vocabulary SM-5 | Review, update with SM-5 algorithm, stats | ☐ | |
| 1.13 | Progress Dashboard | Level, lessons, streak, activity returned | ☐ | |
| 1.14 | GDPR Export/Delete | User can export data and delete account | ☐ | |
| 1.15 | Event-Driven Updates | Lesson complete + conversation end update daily activity | ☐ | |

## 2. Performance Benchmarks

| # | Check | Target | Measured | Pass |
|---|-------|--------|----------|------|
| 2.1 | Auth endpoints | p95 < 500ms | | ☐ |
| 2.2 | Lesson generation | p95 < 8s | | ☐ |
| 2.3 | Conversation AI turn | p95 < 3s | | ☐ |
| 2.4 | Pronunciation scoring | p95 < 2s | | ☐ |
| 2.5 | TTS synthesis | p95 < 3s | | ☐ |
| 2.6 | Progress dashboard | p95 < 500ms | | ☐ |
| 2.7 | Placement test | p95 < 2s | | ☐ |
| 2.8 | Vocabulary review | p95 < 300ms | | ☐ |
| 2.9 | Concurrent users (auth) | 100 VUs, error < 5% | | ☐ |
| 2.10 | Concurrent users (lesson) | 20 VUs, error < 10% | | ☐ |
| 2.11 | Concurrent users (mixed) | 25 VUs, error < 10% | | ☐ |

## 3. Cost Benchmarks

| # | Check | Target | Projected | Pass |
|---|-------|--------|-----------|------|
| 3.1 | Monthly AI cost | < $799/month | | ☐ |
| 3.2 | Cost per lesson generation | < $0.02 | | ☐ |
| 3.3 | Cost per conversation turn | < $0.001 | | ☐ |
| 3.4 | Cost per pronunciation | < $0.0015 | | ☐ |
| 3.5 | Cost per TTS call | < $0.01 | | ☐ |
| 3.6 | Monthly hard cap enforced | Blocks at $1,200 | | ☐ |
| 3.7 | Daily user limit | $0.10/user/day | | ☐ |
| 3.8 | Anomaly detection | 10x avg triggers block | | ☐ |

## 4. Reliability & Recovery

| # | Check | Criteria | Status | Notes |
|---|-------|----------|--------|-------|
| 4.1 | Circuit breaker | Opens after 3 failures, cools 5 min | ☐ | |
| 4.2 | Retry with backoff | 3 retries on 429, exponential delay | ☐ | |
| 4.3 | AI provider fallback | Claude → OpenAI on failure | ☐ | |
| 4.4 | Deepgram fallback | Mock STT when API key missing | ☐ | |
| 4.5 | ElevenLabs fallback | Mock TTS when API key missing | ☐ | |
| 4.6 | Content validation | Blocks critical errors, disclaims low confidence | ☐ | |
| 4.7 | Safety filter | Blocks violence/hate/explicit content | ☐ | |
| 4.8 | Message-id replay | Duplicate WebSocket messages ignored | ☐ | |
| 4.9 | Global error filter | Catches all unhandled exceptions | ☐ | |
| 4.10 | Request timeout | 20s AI request timeout | ☐ | |

## 5. Security

| # | Check | Criteria | Status | Notes |
|---|-------|----------|--------|-------|
| 5.1 | JWT authentication | Required on all endpoints (except auth) | ☐ | |
| 5.2 | Password hashing | bcrypt with 12 rounds | ☐ | |
| 5.3 | Input validation | class-validator + whitelist everywhere | ☐ | |
| 5.4 | CORS | Restricted in production | ☐ | |
| 5.5 | GDPR consent | Recorded before data processing | ☐ | |
| 5.6 | GDPR data export | User can download all personal data | ☐ | |
| 5.7 | GDPR delete | User can delete account and all data | ☐ | |
| 5.8 | API key management | Keys in env vars, never in code | ☐ | |
| 5.9 | No secrets in logs | Request ID interceptor strips auth headers | ☐ | |
| 5.10 | Rate limiting | Global rate limiter (TODO: implement) | ☐ | |

## 6. AI Quality

| # | Check | Target | Measured | Pass |
|---|-------|--------|----------|------|
| 6.1 | Lesson exercise variety | 6 types present | | ☐ |
| 6.2 | Lesson CEFR alignment | Matches student level | | ☐ |
| 6.3 | Lesson content safety | No blocked patterns | | ☐ |
| 6.4 | Lesson grammar focus | Present and relevant | | ☐ |
| 6.5 | Conversation response present | Non-empty | | ☐ |
| 6.6 | Conversation score range | 0-100 | | ☐ |
| 6.7 | Conversation corrections format | Array or undefined | | ☐ |
| 6.8 | Pronunciation score range | 0-100 | | ☐ |
| 6.9 | Pronunciation word scores | Array with scores 0-100 | | ☐ |
| 6.10 | Pronunciation feedback | At least 1 feedback item | | ☐ |

## 7. Monitoring & Observability

| # | Check | Criteria | Status | Notes |
|---|-------|----------|--------|-------|
| 7.1 | Request ID logging | Every request has unique trace ID | ☐ | |
| 7.2 | Structured logging | JSON format log output | ☐ | |
| 7.3 | AI cost tracking | Per-call cost storage | ☐ | |
| 7.4 | Monthly cost alert | Warn at 80% of cap | ☐ | |
| 7.5 | Circuit breaker alerts | Log when circuit opens | ☐ | |
| 7.6 | Content flag alerts | Log when content confidence < 50% | ☐ | |
| 7.7 | Error rate monitoring | Track 5xx rate | ☐ | |
| 7.8 | Health endpoint | GET /health (TODO: implement) | ☐ | |

## 8. Infrastructure

| # | Check | Criteria | Status | Notes |
|---|-------|----------|--------|-------|
| 8.1 | Docker build | Multi-stage Dockerfile builds | ☐ | |
| 8.2 | Docker Compose | PostgreSQL 16 + Redis 7 | ☐ | |
| 8.3 | CI pipeline | Lint → test → build on PR | ☐ | |
| 8.4 | Deploy pipeline | Railway deploy + Slack notification | ☐ | |
| 8.5 | Database migrations | Prisma migrate in deploy step | ☐ | |
| 8.6 | Environment variables | All 30+ vars documented | ☐ | |
| 8.7 | .env.example | Template for all required vars | ☐ | |

## 9. Launch Blocker Checklist

Items marked **BLOCKER** must be resolved before production launch.

| # | Blocker | Description | Status |
|---|---------|-------------|--------|
| 9.1 | **BLOCKER** | Speech controller file upload not working without multer config | ☐ |
| 9.2 | **BLOCKER** | Conversation WebSocket requires running server (cannot test in e2e without real socket) | ☐ |
| 9.3 | **BLOCKER** | No database seed for vocabulary bank (lessons depend on existing vocab) | ☐ |
| 9.4 | **BLOCKER** | ModelRouter generates mock cost data (no actual token counting) | ☐ |
| 9.5 | **BLOCKER** | Redis is in-memory only — no persistence across restarts | ☐ |
| 9.6 | **BLOCKER** | No global rate limiter (TODO: `@nestjs/throttler`) | ☐ |
| 9.7 | **WARNING** | ElevenLabs TTS may fail on long text (> 5000 chars) | ☐ |
| 9.8 | **WARNING** | Deepgram mock returns same transcription for all audio | ☐ |
| 9.9 | **WARNING** | Conversation sessions stored in memory — lost on restart | ☐ |
| 9.10 | **WARNING** | No email verification on registration | ☐ |
| 9.11 | **WARNING** | No password reset flow | ☐ |
| 9.12 | **WARNING** | No health check endpoint | ☐ |
| 9.13 | **NICE-TO-HAVE** | Swagger docs missing Phase 2 endpoints | ☐ |
| 9.14 | **NICE-TO-HAVE** | No API version prefix on Phase 2 endpoints (speech, learning, etc.) | ☐ |
| 9.15 | **NICE-TO-HAVE** | Prisma schema indexes not verified via EXPLAIN ANALYZE | ☐ |

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| QA Lead | | | |
| Product Owner | | | |
| DevOps Lead | | | |
