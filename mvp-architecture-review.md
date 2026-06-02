# MVP Architecture — Critical Review

**Reviewers:** Principal Architect, Staff Engineer, AI Infra, Speech AI, CTO  
**Date:** 2026-05-31  
**Document under review:** `mvp-architecture.md`

---

## Severity Key

| Level | Meaning |
|-------|---------|
| **Critical** | Will cause MVP failure if not addressed |
| **High** | Will cause significant technical debt, user churn, or cost overruns |
| **Medium** | Should be fixed before launch, not blocking |
| **Low** | Track for Phase 2 |

---

## 1. Architecture Review

### Issue AR-1: Separate Python speech service is premature

**Severity:** High  
**What:** A dedicated Python FastAPI service for speech processing, deployed as a separate ECS task.  
**Why it's a problem:** At MVP stage, the speech service is 3 thin API wrappers (Deepgram STT, ElevenLabs TTS, ~200 lines of pronunciation analysis). It does NOT do heavy audio processing. A separate service means:
- Separate Dockerfile, build pipeline, CI/CD, deployment
- Inter-service HTTP calls → adds latency (even locally)
- Separate monitoring + alerting
- Another process to crash, another port to configure
- Debugging requires correlating logs across 2 services
- The team (5-7 people) now manages 2 services instead of 1

The doc's own justification is "Python has better audio libraries (librosa, webrtcvad, numpy)." But at MVP, you're NOT using any of those. You're calling Deepgram's HTTPS API. NestJS can do that.

**Recommendation:** Kill the Python service. Fold speech processing into the NestJS monolith as a `SpeechModule`. Use `child_process` or a simple worker thread if you need CPU-bound audio conversion (Opus encoding). Extract to a Python service ONLY when you need custom on-device models or real-time audio processing that Node.js genuinely cannot handle.

**Impact:** Saves 2-3 weeks of DevOps setup, eliminates cross-service debugging, reduces deployment surface by 50%. If you later need Python, extract it — that's a 2-week refactor, not a 6-month architectural decision.

---

### Issue AR-2: Cloudflare + ALB is two layers too many

**Severity:** Medium  
**What:** Cloudflare CDN in front of an ALB.  
**Why it's a problem:** For 10K DAU, you don't need two routing layers. Cloudflare's CDN caches static assets (which Flutter bundles anyway) and audio (which users generate, not share). The ALB handles health checks and routing to 2-4 containers.

**Recommendation:** Use Cloudflare for DNS + DDoS protection + caching static audio samples. Remove the ALB. Use Cloudflare's load balancing or direct DNS to your containers. If using ECS Fargate, the service-level load balancer integrated with ECS is sufficient. Or use Railway/Render which handles this automatically.

**Impact:** Saves ~$25/mo and reduces network complexity. Low priority — fix if already in implementation, don't block shipping.

---

### Issue AR-3: Redis pub/sub in a monolith is unused complexity

**Severity:** Low  
**What:** Redis used for "cache + pub/sub + rate limiting + session store."  
**Why it's a problem:** Pub/sub is meaningful in a microservice architecture where services need to broadcast events. In a monolith, you can use in-process EventEmitter. Adding Redis pub/sub adds a message format, serialization, and a failure mode (what happens when Redis pub/sub delivery fails?) for zero benefit.

**Recommendation:** Use in-process events for the monolith. Redis for cache + rate limiting only. Remove pub/sub from the architecture doc. Add it when you extract services.

**Impact:** Reduces Redis coupling. Low severity — won't block shipping, but don't build against it.

---

## 2. Database Design Review

### Issue DB-1: No backup strategy or point-in-time recovery

**Severity:** Critical  
**What:** Single PostgreSQL instance mentioned, no backup strategy.  
**Why it's a problem:** If the DB corrupts, is dropped, or has a bad migration, you lose ALL user progress. For a learning app, losing progress data = users quit forever. The doc mentions RDS but not automated backups, PITR, or even pg_dump.

**Recommendation:** Enable RDS automated backups (7-day retention) with point-in-time recovery. Cost: ~$5-10/mo extra. Document the restore procedure. Test it before launch.

**Impact:** Protects against catastrophic data loss. ~$10/mo insurance policy.

---

### Issue DB-2: No migration strategy documented

**Severity:** High  
**What:** Prisma mentioned as ORM but no discussion of migration workflow.  
**Why it's a problem:** AI-generated schema means schema will change frequently as you iterate on features. Without a disciplined migration strategy, you'll have:
- Production data loss from bad migrations
- Dev/prod schema drift
- No rollback capability
- Team members running migrations differently

**Recommendation:** Define the migration workflow now:
1. All migrations are code-reviewed
2. Migrations are one-directional (write down-only migrations, test rollbacks)
3. Prisma `migrate dev` for development, `migrate deploy` for production
4. Staging DB must run migrations before production
5. Document rollback procedure: restore from backup, not "migrate down"

**Impact:** Prevents the #1 cause of production data loss in early-stage startups.

---

### Issue DB-3: JSONB overuse will haunt analytics

**Severity:** Medium  
**What:** `phoneme_scores` (JSONB), `content` (JSONB), `definitions` (JSONB), `examples` (JSONB) in multiple tables.  
**Why it's a problem:** JSONB is great for write-once-read-rarely data. But you WILL want to query:
- "How many users struggle with /θ/ phoneme?" (product analytics)
- "What's the average lesson completion rate?" (retention analysis)
- "Which grammar points cause the most errors?" (content improvement)

JSONB queries with `->>` operators work but are slow at scale and don't benefit from the type system. Prisma's JSONB support is limited — you lose type safety.

**Recommendation:** Keep JSONB for truly variable data (`phoneme_scores`, `prosody_metrics`) but extract queryable fields into columns. For lesson content, keep JSONB (lessons aren't queried). For vocabulary definitions/examples, consider a separate table — these WILL be queried.

**Impact:** Saves 2-3 months of refactoring when you need analytics in Phase 2. Low immediate impact but high future cost if ignored.

---

### Issue DB-4: `speech_sessions` table will grow unbounded

**Severity:** Medium  
**What:** No partitioning or archiving strategy for speech data. 10K users × 3 sessions/day × 30 days = 900K rows/month. By month 6, you have ~5M rows in this table alone.  
**Why it's a problem:** Queries with `ORDER BY created_at DESC` will slow down. Backups will take longer. Prisma operations may time out.

**Recommendation:** Add a cleanup job (monthly) that archives sessions older than 90 days to a cheaper store (S3 as Parquet) or partitions the table by month. Add the partition strategy to the schema now — adding partitions to a live 5M-row table is painful.

**Impact:** Prevents a performance crisis around month 4-5.

---

## 3. API Design Review

### Issue API-1: Single WebSocket endpoint with no reconnection strategy

**Severity:** High  
**What:** `WSS /v1/conversations/{sessionId}` for conversation, no reconnection protocol.  
**Why it's a problem:** Mobile networks drop WebSocket connections frequently. If a user loses connection mid-conversation:
1. They lose the current turn (audio already sent but not saved)
2. They see "connection lost" — bad UX
3. They have to restart the conversation
4. If the monolith is behind a load balancer, sticky sessions are required

**Recommendation:** Implement a message-id-based replay protocol. Client sends `{ messageId, audio }`, server acknowledges with `{ messageId, status: "received" }`. On reconnect, client re-sends unacknowledged messages. The session persists the conversation state so users can resume.

**Impact:** Critical for mobile UX. Without this, conversation feature will be unreliable on cellular networks.

---

### Issue API-2: No request ID tracing

**Severity:** Medium  
**What:** No mention of correlation IDs or structured logging.  
**Why it's a problem:** When a user reports "the app gave me wrong pronunciation feedback", you need to trace: their audio → STT → phoneme analysis → score → response. Without a request ID across the entire chain, debugging is "look at timestamps and guess."

**Recommendation:** Add a `X-Request-Id` header (UUID) on every API response. Log it in every service call. Include it in Sentry error reports. This is ~50 lines of NestJS middleware.

**Impact:** Reduces debugging time for production issues by 10x. Essential for an AI-heavy app where errors are subtle.

---

### Issue API-3: No API versioning strategy for mobile

**Severity:** Medium  
**What:** URL prefix `/v1/` but no discussion of how to handle mobile API versioning.  
**Why it's a problem:** Flutter app stores don't force updates. You'll have users on old app versions hitting new API versions (or vice versa). Without a version negotiation strategy, old clients will break when you change API contracts.

**Recommendation:** Add a `min-app-version` header or endpoint that the client checks at startup. If the app is too old, show a "please update" screen. Keep `/v1/` stable; break changes go to `/v2/`. Support old versions for 3 months minimum.

**Impact:** Prevents "app broke after server update" support tickets.

---

## 4. AI Layer Review

### Issue AI-1: No content validation for AI output (critical trust risk)

**Severity:** Critical  
**What:** AI-generated lessons, conversation responses, corrections are sent directly to users without validation.  
**Why it's a problem:** LLMs hallucinate. In a language learning context, hallucinated content means:
- **Wrong grammar rules** → user learns incorrect language
- **Made-up vocabulary** → user tries to use fake words
- **Inappropriate content** → for a product that may have under-18 users, this is a legal risk
- **Cultural insensitivity** → could offend users and cause PR disaster

A single incident of "the AI taught me wrong English" posted on social media kills the product.

**Recommendation:** Build a validation layer:
1. **Structural validation** — AI output matches expected JSON schema (use Zod in NestJS)
2. **Content validation** — Check vocabulary exists in bank, grammar rules match known patterns
3. **Safety filter** — Block profanity, violence, or inappropriate content
4. **Sampling QA** — Log 100% of AI outputs for manual review; label the first 1,000 to find failure modes

This is NOT a Phase 2 feature. This is a launch blocker.

**Impact:** Prevents catastrophic trust failure. Without this, do not launch.

---

### Issue AI-2: No OpenAI fallback or circuit breaker

**Severity:** Critical  
**What:** All AI calls go to OpenAI. No fallback provider. No circuit breaker.  
**Why it's a problem:** OpenAI has had 12+ major outages in the past 18 months (some lasting hours). If OpenAI is down:
- No daily lessons
- No conversation practice
- No error correction
- No roadmap generation
- The entire app is a login screen

For a learning app that users pay for, this is unacceptable.

**Recommendation:** Add:
1. **Fallback model** — Anthropic Claude 3 Haiku for cheap tasks, Sonnet for important ones. Cost: ~same as GPT-4o-mini.
2. **Circuit breaker** — After 3 consecutive failures to OpenAI, switch to fallback for 5 minutes, then retry.
3. **Graceful degradation** — If ALL AI providers are down, serve cached lessons and basic conversation trees (hardcoded scripts for each level/scenario).

**Impact:** Ensures 99.9% uptime for core features. Cost: ~$100/mo extra for redundancy.

---

### Issue AI-3: No prompt versioning or A/B testing

**Severity:** High  
**What:** Prompts are TypeScript template strings in Git.  
**Why it's a problem:** Prompts are the most critical code in the app. A single word change in a prompt can:
- Improve lesson quality by 30%
- Or completely break output format (JSON parse failures)
- Or introduce bias/inappropriate content
- Or double token usage

Without versioning, you can't:
- Roll back a bad prompt change
- A/B test prompt strategies
- Know which prompt generated which lesson (for debugging)
- Measure prompt quality over time

The doc dismisses this as "6 prompts don't need a system." This is wrong. 6 prompts that generate every piece of user-facing content ARE the product.

**Recommendation:** You don't need a DB for this. Store prompts as JSON files with a version field:
```
prompts/
  lesson.v1.json
  conversation.v2.json
  correction.v1.json
```
Store the version in the AI response record. This lets you:
- Correlate output quality with prompt version
- Roll back by reverting a file
- A/B test by sampling versions per user

This is a 2-hour change, not a system. But not having it is a risk.

**Impact:** Prevents "why are lessons suddenly worse?" debugging nightmare.

---

### Issue AI-4: No cost caps or anomaly detection

**Severity:** High  
**What:** Per-user daily cost tracking but no total monthly cap.  
**Why it's a problem:** A single bug (e.g., infinite retry loop, runaway conversation) can cost thousands. Without a hard cap:
- A prompt bug that repeats API calls could burn $500 in an hour
- A malicious user could automate the conversation endpoint
- There's no alert when costs spike

**Recommendation:** Add:
1. **Hard monthly cap** on total API spending (e.g., $1,000/mo — 80% of budget)
2. **Auto-pause** — When cap is hit, non-critical AI features degrade (fall back to cached content)
3. **Anomaly detection** — Alert if any single user's cost exceeds 10x the daily average
4. **Dashboard** — Real-time AI cost tracking visible to the team

**Impact:** Prevents a "our API bill is $8,000 this month" surprise.

---

## 5. Speech Pipeline Review

### Issue SP-1: Montreal Forced Aligner is a hidden time bomb

**Severity:** Critical  
**What:** Pronunciation analysis depends on Montreal Forced Aligner (MFA) for phoneme-level alignment.  
**Why it's a problem:** MFA requires pre-trained acoustic models for each language pair. For Hindi-English:
1. **No high-quality Hindi MFA model exists publicly** — The official MFA model for Hindi was trained on limited data and has poor accuracy
2. **Training a custom MFA model** requires 5+ hours of transcribed audio per speaker, 10+ speakers, phoneme-level annotations — that's 2-3 months of work for a dedicated team
3. **MFA is CPU-bound** — Each alignment takes 2-10 seconds. For 10K users × 3 sessions, you need a cluster of CPU instances, not a single Fargate task
4. **MFA doesn't support streaming** — You need the full utterance before alignment, adding latency

The doc treats MFA as a solved "install and go" dependency. It's not. It's the highest-risk technical decision in the entire architecture.

**Recommendation:** Replace MFA with Deepgram's built-in pronunciation scoring:
- Deepgram Nova-2 provides `confidence` scores at the word and phoneme level via custom dictionary
- Use Deepgram's `utterance` endpoint with a custom pronunciation dictionary for the target language
- For phoneme-level feedback, use Deepgram's `diarize` + `utterances` to align expected vs. actual
- This eliminates the MFA dependency entirely

Fallback: Use WhisperX (which includes phoneme-level alignment via Wav2Vec2) as a self-hosted alternative. Still less risky than MFA for Hindi.

**Impact:** Removes the single biggest technical risk in the MVP. Saves 2-3 months of potential MFA integration/debugging time.

---

### Issue SP-2: No audio preprocessing for real-world conditions

**Severity:** High  
**What:** Assumes users have good microphones in quiet environments.  
**Why it's a problem:** Users will be on noisy streets, in cafes, on public transport (especially in India). Raw audio with background noise:
- Reduces STT accuracy by 30-50%
- Makes phoneme scoring unreliable
- Creates false negatives ("you pronounced it wrong" when actually it was background noise)
- Frustrates users who are "doing it right" but getting low scores

**Recommendation:** Add server-side audio preprocessing before STT:
1. **Noise gate** — Silence below -50dB is trimmed (reduces processing cost too)
2. **Normalization** — Peak normalization to -3dB (std. audio level)
3. **High-pass filter** — Remove rumble below 80Hz (traffic noise)
4. **Voice activity detection** — Trim silence from start/end (reduces STT cost by 20-30%)

This is 50 lines of Python (or Node.js with `node-wav` + `webrtcvad`). Do it.

**Impact:** Improves pronunciation score accuracy by 20-40% in noisy environments. Directly impacts user trust in the core differentiator.

---

### Issue SP-3: No graceful degradation for speech features

**Severity:** High  
**What:** If STT or TTS fails, the whole feature fails.  
**Why it's a problem:** Deepgram and ElevenLabs have had outages. When they're down:
- Speaking exercises don't work (can't score pronunciation)
- Conversation doesn't work (can't transcribe or speak)
- The app's core differentiator is dead

**Recommendation:** Define degradation modes:
1. **STT down** → Fall back to text input for exercises and conversation. Users type their response. Lower quality, but functional.
2. **TTS down** → Show text instead of audio. Use system TTS as cheap fallback.
3. **Pronunciation scoring down** → Skip phoneme scoring. Show "could not analyze" with a retry button.

This is about 10 conditional statements. Prevents "app is useless" during provider outages.

**Impact:** Converts a "site down" incident into a "reduced functionality" incident.

---

## 6. Infrastructure Review

### Issue INFRA-1: ECS Fargate adds unnecessary complexity

**Severity:** Medium  
**What:** ECS Fargate with 2-4 containers, ALB, task definitions, CloudWatch.  
**Why it's a problem:** Fargate requires:
- Docker knowledge for every team member
- Task definition management (IAM roles, networking, environment variables)
- CloudWatch for logs (which is slow and expensive to query)
- ALB configuration
- At least 2 replicas for high availability (doubling compute cost)

For a 5-7 person team, this is significant DevOps overhead that distracts from product development.

**Recommendation:** Use Railway, Render, or Fly.io for MVP:
- Single `docker-compose up` deployment
- Automatic HTTPS, logging, monitoring
- Zero DevOps team required
- Handles 10K DAU easily
- Cost: ~$100-150/mo (less than Fargate + ALB)
- Migration to Fargate/K8s when you need it (Phase 2/3)

Counterargument: "Vendor lock-in." No. The app is a NestJS monolith + PostgreSQL. This runs on any platform. Dockerfile stays the same. Migration is a 1-day effort.

**Impact:** Saves 2-3 weeks of DevOps setup. Reduces daily ops burden. Eliminates need for a DevOps hire.

---

### Issue INFRA-2: No staging environment

**Severity:** High  
**What:** Only production mentioned.  
**Why it's a problem:** Without a staging environment:
- Every API migration is tested on production data (or not tested at all)
- AI prompt changes are deployed directly to users
- You can't test integrations (Deepgram, ElevenLabs) before they hit production
- You can't run load tests without affecting real users

**Recommendation:** Add a staging environment:
- Same architecture, smaller instances (0.5 vCPU each)
- Separate PostgreSQL (smaller), separate Redis
- Same external API keys (costs ~$50/mo additional)
- Deploy to staging on PR merge; promote to production after verification

**Impact:** Prevents "we broke production" incidents. Costs ~$80/mo.

---

## 7. Cost Model Review

### Issue COST-1: Cost model assumes perfect linear scaling

**Severity:** High  
**What:** Cost estimate assumes 10K users × 20 sessions/mo × fixed per-session cost.  
**Why it's a problem:** Real usage is never uniform:
- 20% of users generate 80% of cost (power users doing 5+ sessions/day)
- Conversation sessions vary wildly (2 turns vs. 20 turns)
- Lesson generation tokens vary by CEFR level (higher levels = longer lessons)
- STT cost doubles with background noise (longer audio, retries)
- No buffer for testing, monitoring, or development API usage

Realistic costs: ~$1,800-2,500/mo, not $1,200/mo.

**Recommendation:** 
1. Budget $2,500/mo for AI costs, not $1,200
2. Add usage monitoring from day 1 (real-time cost dashboard)
3. Add hard caps per user tier (already in design, but make it enforceable)
4. Negotiate volume pricing with Deepgram/ElevenLabs at month 3 (10K users is enough for 20-30% discount)

**Impact:** Prevents running out of budget. Realistic planning.

---

### Issue COST-2: No monetization model in MVP plan

**Severity:** Medium  
**What:** MVP has no pricing tier, no billing integration.  
**Why it's a problem:** If you ship with zero revenue, every day is burning cash. The cost model assumes free users. If VCs ask "what's the unit economics?" you have no answer. More importantly, you haven't tested willingness to pay.

**Recommendation:** Add a "Coming Soon: Premium" prompt in the app that surveys willingness to pay. Even if you don't charge for MVP, instrument the feature usage to understand which features drive retention (those are the ones to monetize). Prepare the data model for tiers (add `tier` field to users).

**Impact:** Not blocking, but the doc should acknowledge this gap. Price discovery takes 3+ months — start now.

---

## 8. Mobile Performance Review

### Issue MOBILE-1: No offline support for core features

**Severity:** High  
**What:** Voice-first app with no offline capability.  
**Why it's a problem:** Target market includes India, where:
- 40% of users have unreliable internet
- Mobile data is expensive relative to income
- Users download content at home/WiFi to use later
- A voice app that requires constant connectivity will be uninstalled after the first "connection lost" error

**Recommendation:** Implement offline support incrementally:
1. **P0 (Week 1):** Cache today's lesson locally after loading. Allow completing exercises offline, sync results when online.
2. **P1 (Week 4):** Cache 5 vocabulary review items. Allow reviewing offline.
3. **P2 (Week 8):** Basic offline conversation trees (pre-scripted, not AI-generated).

The key insight: for exercises (repeat, MCQ, fill-in-blank), you don't need AI during the exercise. You only need AI to generate content and score results. Both can be async.

**Impact:** Without this, you lose 30%+ of the Indian market to connectivity issues.

---

### Issue MOBILE-2: App size and audio library management

**Severity:** Medium  
**What:** Audio recording, encoding, and playback libraries in Flutter.  
**Why it's a problem:** Flutter's audio ecosystem is fragmented:
- `record` package for recording (OK)
- `opus` encoding requires native FFI or platform channels
- Playback needs separate packages
- Audio processing on mobile varies significantly between Android and iOS

The app size with all audio libraries: ~30-40MB for the base Flutter app + 10-15MB for audio native libraries.

**Recommendation:** 
1. Use Flutter's `record` package for capture, send raw WAV to server, do encoding server-side
2. This simplifies mobile code and keeps app size under 25MB
3. Server-side encoding also means you can change codecs without app update
4. Test on mid-range Android devices (₹15,000 range) — these are the target devices

**Impact:** Prevents "app doesn't record on my phone" support tickets.

---

## 9. Product & Timeline Review

### Issue PRODUCT-1: 6-month timeline is unrealistic for this scope

**Severity:** High  
**What:** 24 weeks to build: auth, placement test, roadmap generator, daily lesson engine, pronunciation analyzer, AI conversation (18 scenarios), error correction, vocabulary with SM-5, progress dashboard, assessments, Hindi language pack — with a team of 5-7.  
**Why it's a problem:** Let's do the math:
- 5-7 people × 24 weeks = 120-168 person-weeks
- Pronunciation analysis (hardest part): 1 specialist × 8 weeks = 8 person-weeks minimum
- Conversation simulator + scenario design: 1-2 people × 6 weeks = 6-12 person-weeks
- Lesson engine: 1 person × 6 weeks = 6 person-weeks
- Flutter UI for all of the above: 1-2 people × 20 weeks = 20-40 person-weeks
- Hindi language pack: requires native speaker QA, not just engineering

Even with perfect execution, the actual AI quality (pronunciation scoring accuracy, conversation naturalness) will take 2-3 iterations to get right. The timeline assumes "first version works."

**Recommendation:** Cut scope further:
1. **Kill conversation levels 4-6** — Ship levels 1-3 (9 scenarios). Levels 4-6 in Phase 2. That saves 3-4 weeks.
2. **Kill roadmap generator autonomy** — Generate roadmap once at onboarding, don't regenerate. Save 2 weeks.
3. **Simplify placement test** — 10-15 questions, not adaptive. Just enough to bin users into A1/A2/B1. Save 2 weeks.
4. **Ship Hindi in Phase 2** — English only at launch. Hindi adds 4 weeks of work (models, content, QA). Save 4 weeks.

Total savings: 11-12 weeks. That makes the 24-week timeline achievable AND gives you buffer for AI quality iteration.

**Impact:** Without cuts, the team will either (a) ship buggy AI that churns users, or (b) delay launch by 2-3 months. Both outcomes kill the product.

---

### Issue PRODUCT-2: No user retention strategy

**Severity:** High  
**What:** The product assumes "AI generates fresh content daily" is enough for retention.  
**Why it's a problem:** Language learning apps have 30% D1 retention and 5% D30 retention on average (industry data). The doc's only retention mechanism is "streaks." That's not enough.

Missing:
- **Push notifications** — No mention of push notification infrastructure
- **Social features** — No mention of friends, challenges, or sharing
- **Goal commitment** — No "set a goal, commit to it" flow
- **Progress celebration** — No "you've been studying for 30 days!" moments
- **Loss aversion** — No "your streak will end" notifications

**Recommendation:** Add a basic retention stack (1 week of work):
1. Push notification service (Firebase Cloud Messaging)
2. Daily reminder ("Your lesson is ready!") — configurable time
3. End-of-day summary notification ("You learned 5 words today")
4. 3-day inactive re-engagement email
5. Streak recovery (1 free streak freeze per week)

**Impact:** Without these, expect 80% user churn by week 4.

---

### Issue PRODUCT-3: No privacy/compliance consideration

**Severity:** High  
**What:** Voice data collection with no mention of privacy, consent, or compliance.  
**Why it's a problem:** Voice recordings are biometric data. In many jurisdictions:
- **GDPR (Europe):** Requires explicit consent for biometric data processing
- **India DPDP Act 2023:** Requires consent for processing personal data, and voice is sensitive personal data
- **COPPA (US children):** If users under 13 (language learners often are), strict rules apply
- **No mention of data retention or deletion policies**

If you ship without these, you're exposed to regulatory action.

**Recommendation:** Add to the MVP plan:
1. Privacy policy drafted before launch (use a template, customize)
2. Consent screen during onboarding ("we record your voice to analyze pronunciation")
3. Data deletion endpoint (already in API as `DELETE /v1/users/me` — ensure it actually deletes S3 audio too)
4. Age gate: if user < 13, disable recording or require parental consent
5. Audio retention: 30 days in S3, then delete (mention in privacy policy)

**Impact:** Legal risk. Most startups ignore this and regret it.

---

## Summary of All Issues

| ID | Issue | Severity | Category |
|----|-------|----------|----------|
| AR-1 | Separate Python service premature | High | Over-engineering |
| AR-2 | Cloudflare + ALB redundant | Medium | Over-engineering |
| AR-3 | Redis pub/sub in monolith | Low | Over-engineering |
| DB-1 | No backup strategy | Critical | Under-engineering |
| DB-2 | No migration workflow | High | Under-engineering |
| DB-3 | JSONB overuse for queryable data | Medium | Database risk |
| DB-4 | Unbounded speech_sessions growth | Medium | Database risk |
| API-1 | No WebSocket reconnection | High | Under-engineering |
| API-2 | No request tracing | Medium | Under-engineering |
| API-3 | No mobile version strategy | Medium | Product risk |
| AI-1 | No content validation | Critical | AI risk |
| AI-2 | No OpenAI fallback/circuit breaker | Critical | AI risk |
| AI-3 | No prompt versioning | High | AI risk |
| AI-4 | No cost caps/anomaly detection | High | Cost risk |
| SP-1 | MFA for Hindi is a time bomb | Critical | Speech risk |
| SP-2 | No audio preprocessing | High | Speech risk |
| SP-3 | No speech degradation | High | Speech risk |
| INFRA-1 | ECS Fargate over-engineering | Medium | Over-engineering |
| INFRA-2 | No staging environment | High | Under-engineering |
| COST-1 | Cost model undershoots | High | Cost risk |
| COST-2 | No monetization strategy | Medium | Product risk |
| MOBILE-1 | No offline support | High | Mobile risk |
| MOBILE-2 | Audio library bloat | Medium | Mobile risk |
| PRODUCT-1 | Timeline unrealistic | High | Product risk |
| PRODUCT-2 | No retention strategy | High | Product risk |
| PRODUCT-3 | No privacy/compliance | High | Product risk |

---

## A. Final Recommended Architecture (Revised)

```
┌─────────────────────────────────────────────────────────────┐
│                    Flutter Mobile App                         │
│                  (Android + iOS)                              │
│          on-device: VAD + audio cache                         │
│          offline: cached lesson + vocab review                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WSS (with reconnect)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare (DNS + CDN)                     │
│                    Automatic HTTPS                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                Railway / Render / Fly.io                      │
│                                                               │
│              ┌─────────────────────────────────┐              │
│              │   NestJS Monolith                │              │
│              │   (1 process, 2 replicas)        │              │
│              │                                  │              │
│              │  Modules:                        │              │
│              │  ├─ AuthModule                   │              │
│              │  ├─ UserModule                   │              │
│              │  ├─ AssessmentModule             │              │
│              │  ├─ LearningModule               │              │
│              │  ├─ ConversationModule (WS)      │              │
│              │  ├─ VocabularyModule             │              │
│              │  ├─ ProgressModule               │              │
│              │  ├─ AdminModule (secured)        │              │
│              │  ├─ SpeechModule (API wrappers)  │              │
│              │  │  ├─ Deepgram STT              │              │
│              │  │  ├─ Pronunciation (Deepgram) │              │
│              │  │  └─ ElevenLabs TTS            │              │
│              │  ├─ AIGateway                    │              │
│              │  │  ├─ ModelRouter (if-else)     │              │
│              │  │  ├─ ContentValidator          │  ← NEW      │
│              │  │  ├─ CircuitBreaker            │  ← NEW      │
│              │  │  └─ CostGuard                 │              │
│              │  └─ MonitoringMiddleware         │  ← NEW      │
│              │     ├─ Request tracing           │              │
│              │     └─ Structured logging        │              │
│              └────────────────┬────────────────┘              │
│                               │                                │
└───────────────────────────────┼────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────┐   ┌────────────────────┐
│  PostgreSQL 16   │   │   Redis 7   │   │  S3 (audio +      │
│  (1 writer +     │   │  (cache +   │   │   images)          │
│  automated       │   │   rate      │   │                    │
│  backups)        │   │   limiting) │   │  TTL: 30d audio   │
│  [Staging too]   │   │             │   │  + cleanup Lambda  │
└─────────────────┘   └─────────────┘   └────────────────────┘
                                │
                                ▼
                      ┌──────────────────────┐
                      │  External APIs:       │
                      │  • OpenAI GPT-4o     │
                      │  • Anthropic Claude  │  ← NEW (fallback)
                      │  • Deepgram STT      │
                      │  • ElevenLabs TTS    │
                      │  • Firebase (push)   │
                      │  • SendGrid Email    │
                      └──────────────────────┘
```

### Key Changes from Original

1. **No separate Python service** — Speech is a NestJS module, not a separate deployment
2. **No ALB** — Platform handles routing and HTTPS
3. **No Redis pub/sub** — In-process events
4. **No MFA** — Deepgram pronunciation scoring instead
5. **Added Content Validator** — Critical AI trust layer
6. **Added Circuit Breaker** — OpenAI → Anthropic fallback
7. **Added Request Tracing** — Every request gets a correlation ID
8. **Added Staging Environment** — Same architecture, smaller instances
9. **Added Firebase Push** — Retention infrastructure
10. **Added S3 Cleanup Lambda** — Automated audio retention enforcement

---

## B. MVP Architecture Diagram (Sequence)

```
                          MVP USER FLOW

  Onboarding                    Daily Loop                      Weekly
  ──────────                    ──────────                      ──────
  Sign up ──►                   ┌──────────────────┐            │
    │                           │  Push: "Lesson    │            │
    ▼                           │  ready!"          │            │
  Microphone test               └────────┬─────────┘            │
    │                                    ▼                      │
    ▼                           Open app → Fetch today's       │
  Placement test                lesson (AI-gen, cached)        │
  (10-15 questions)                 │                          │
    │                               ▼                          │
    ▼                       Work through exercises:            │
  CEFR bin (A1/A2/B1)        • Listen & answer                 │
    │                        • Speak & get scored              │
    ▼                        • Vocabulary review               │  Weekly
  Roadmap generated          • Grammar fill-in                │  assessment
  (3/6/12 month plan)            │                            │  (15 min)
    │                               ▼                          │
    ▼                       Conversation practice             │
  Daily lessons begin       (1 session, 5-10 turns)          │
    │                           │                             │
    ▼                           ▼                             ▼
                        Progress updated              Score tracked
                        Streak incremented            CEFR re-evaluated
                        Vocab due for review
```

---

## C. Go / No-Go Decision

**CONDITIONAL GO** — conditional on fixing the 10 changes below before development starts.

The architecture direction (monolith, PostgreSQL, REST, 16 tables, SM-5) is correct. The cost model, team size, and language focus are reasonable. The identified gaps (content validation, MFA replacement, cost controls, OpenAI fallback, backup strategy, retention, offline, privacy) are fixable within the 6-month timeline — but only if addressed NOW, not deferred.

**No-Go triggers (any one of these kills the project):**
1. Proceeding with MFA for Hindi pronunciation scoring without a working prototype in Week 2
2. Shipping AI-generated content without a validation layer
3. No OpenAI fallback at launch
4. No backup strategy for PostgreSQL
5. No offline support for the Indian market
6. Shipping Hindi at MVP (adds 4 weeks to a timeline that's already tight)

---

## D. Top 10 Changes Required Before Development Starts

### 1. Replace MFA with Deepgram Pronunciation Scoring

**Action:** Remove Montreal Forced Aligner from the architecture. Use Deepgram Nova-2's built-in pronunciation scoring with custom dictionaries.  
**Owner:** Speech/AI Engineer  
**Timeline:** Week 1 decision, Week 2 prototype  
**Why before dev starts:** The entire pronunciation scoring pipeline depends on this choice. If you start coding against MFA and it fails (which it will for Hindi), you waste 6-8 weeks.

### 2. Add Content Validation Layer

**Action:** Build a Zod schema validator for every AI output type (lesson, conversation response, correction, assessment). Add a safety filter for inappropriate content.  
**Owner:** Backend Engineer  
**Timeline:** Week 1-2  
**Why before dev starts:** AI output validation must be part of the AI module from day 1, not bolted on later.

### 3. Add OpenAI Fallback (Anthropic Claude)

**Action:** Register for Anthropic API. Add a CircuitBreaker class in the AIGateway module. Configure it to switch to Claude 3 Haiku/Sonnet after 3 consecutive OpenAI failures.  
**Owner:** Backend Engineer  
**Timeline:** Week 1 (it's ~100 lines of code)  
**Why before dev starts:** If you build all AI features against OpenAI only, adding a fallback later requires refactoring every prompt call.

### 4. Kill the Python Service, Fold Into NestJS

**Action:** Remove the Python speech service from the architecture. Add a SpeechModule to NestJS that calls Deepgram and ElevenLabs APIs directly.  
**Owner:** Backend Engineer  
**Timeline:** Week 1  
**Why before dev starts:** This changes the deployment model, CI/CD, monitoring, and debugging approach. Start with the simpler architecture.

### 5. Add Cost Controls and Monitoring

**Action:** Implement per-user daily cost caps, a total monthly cap ($1,000 alert, $1,200 hard stop), and a real-time cost dashboard.  
**Owner:** Backend Engineer  
**Timeline:** Week 2-3  
**Why before dev starts:** You need cost tracking before real users generate costs. Add it before beta.

### 6. Cut Scope: Levels 1-3 Only, English Only, Hindi in Phase 2

**Action:** Reduce conversation levels from 6 to 3 (9 scenarios total). Remove Hindi from MVP scope. Add Hindi as Phase 2, month 7.  
**Owner:** Product Manager  
**Timeline:** Before sprint planning  
**Why before dev starts:** The 6-month timeline is unrealistic with the current scope. These cuts save 11-12 weeks, giving you buffer for AI quality iteration.

### 7. Add Database Backup Strategy

**Action:** Enable RDS automated backups with 7-day PITR retention. Document the restore procedure. Test it.  
**Owner:** Backend Engineer  
**Timeline:** Week 1 (30-minute AWS config change)  
**Why before dev starts:** Should be configured before any user data exists.

### 8. Add Offline Support (Incremental)

**Action:** Week 1: cache today's lesson locally. Week 4: cache vocabulary reviews. Week 8: basic offline conversation trees.  
**Owner:** Mobile Engineer  
**Timeline:** Starting Week 1  
**Why before dev starts:** Offline affects the data model (local storage schema), API design (sync endpoints), and mobile architecture. Design for it from day 1 even if you ship incrementally.

### 9. Add Push Notification and Retention Infrastructure

**Action:** Add Firebase Cloud Messaging. Implement daily reminder notifications, streak recovery (1 free freeze/week), and 3-day inactivity email trigger.  
**Owner:** Mobile Engineer + Backend Engineer  
**Timeline:** Week 3-5  
**Why before dev starts:** Notifications need to be in the app from the first user session. Adding them later requires an app store update.

### 10. Add Privacy/Compliance Foundation

**Action:** Draft privacy policy. Add consent screen to onboarding. Build data deletion endpoint (including S3 audio). Add age gate (< 13 = no recording without parental consent).  
**Owner:** Product Manager + Backend Engineer  
**Timeline:** Week 2-4  
**Why before dev starts:** Consent must be collected from the first user. You can't retroactively ask users for voice recording consent.

---

## Final Word

The MVP architecture document is 70% correct. The monolith decision, database schema, REST API, SM-5 algorithm, and cost-conscious design are all the right calls.

The 30% that's wrong will kill the product if not fixed:
- **MFA for Hindi** will silently consume 2-3 months of engineering time and then fail
- **No content validation** will produce a launch-day social media disaster
- **No OpenAI fallback** means outages kill the product
- **No offline support** loses 30%+ of the Indian market
- **No backup strategy** is one bad migration away from losing everything
- **Over-scoped timeline** guarantees a rushed, buggy launch

Fix these 10 things. Ship English-only, levels 1-3, with validation, fallback, tracking, retention, and offline. That's a successful MVP.
