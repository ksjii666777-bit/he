# HE v1.0.0 — Release Notes

**Release Date:** 2026-06-01
**Version:** 1.0.0-rc.1
**Codename:** "Bonjour World"

---

## Overview

HE is an AI-powered language learning platform that generates personalized lessons, facilitates speaking practice through conversational AI, and provides grammar correction across multiple languages. This release marks the beta launch.

---

## What's Included

### AI Engine
- **Lesson Generation** — dynamic AI-generated lessons across 12 CEFR levels (A1–C2) with 6 exercise types (multiple-choice, fill-in-blank, pronunciation, conversation, matching, ordering)
- **Conversation Practice** — contextual role-play conversations across 5 relationship dynamics (friend, boss, stranger, teacher, child) with real-time grammar correction
- **Grammar Correction** — automatic error detection with contextual explanations and corrected text
- **Content Safety** — automated validation blocks violence, hate speech, sexual content, self-harm, and drug references

### Platform
- **NestJS Backend** — modular monolith with 21 authenticated REST endpoints + WebSocket support
- **OpenRouter AI Integration** — Qwen3-Next 80B A3B Instruct for lesson/conversation/correction; planned Claude fallback
- **PostgreSQL + Redis** — primary database and session/cache layer
- **JWT Authentication** — access + refresh token flow with Google OAuth support
- **Rate Limiting** — per-endpoint throttling (60 req/min general, 5 req/min for auth)
- **Swagger Docs** — interactive API documentation at `/docs`

### Data & Content
- **123 Vocabulary Entries** — across English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Mandarin, Arabic
- **45 Grammar Lessons** — covering 8 languages with structured explanations and examples
- **20 Conversation Scenarios** — A1–B1 level scenarios across travel, work, social, education, and daily life

### Demo Accounts
| Account | Email | Password | CEFR | Native Language | Interest |
|---------|-------|----------|------|----------------|----------|
| Beginner | `beginner@he.app` | `DemoPass123!` | A1 | English | Travel |
| Intermediate | `intermediate@he.app` | `DemoPass123!` | B1 | French | Work |
| Advanced | `advanced@he.app` | `DemoPass123!` | C1 | Spanish | Fluency |

---

## Deployment Architecture

| Component | Provider | Config |
|-----------|----------|--------|
| API Server | Railway | 2 replicas, 2 vCPU, 4 GB RAM |
| Database | Railway PostgreSQL | 1 GB, daily backups, 30-day retention |
| Cache | Railway Redis | 250 MB, AOF persistence |
| AI Gateway | OpenRouter | Qwen3-Next 80B (~$0.04/call) |
| DNS + DDoS | Cloudflare | Full SSL strict, WAF, CDN |
| Monitoring | Sentry + Prometheus | Error tracking + custom metrics |
| Uptime | Better Uptime | 1-min checks, SSL expiry alerts |

### Estimated Monthly Cost: **$67–$271**
- Railway hosting: $25–$50
- PostgreSQL: $5–$10
- Redis: $5–$10
- OpenRouter AI: $30–$150
- Sentry: $26/seat
- S3 storage: <$1

---

## Known Issues (Top 5)

| ID | Issue | Severity | Workaround |
|----|-------|----------|------------|
| K1 | No second AI provider fallback; OpenRouter outage = full downtime | Critical | Monitor OpenRouter status; manual re-route |
| K2 | Email verification not implemented; users unverified | Critical | Manual verification in Railway dashboard |
| K3 | Speech features (STT/TTS) blocked — Deepgram/ElevenLabs keys missing | High | Mock audio endpoints used; update env vars when keys ready |
| K4 | Docker Desktop periodic crashes on Windows (pipe API 500) | Low | `wsl --shutdown` + restart Docker Desktop |
| K5 | ContentValidator flags `question` missing on pronunciation/conversation exercises (false positive) | Low | Validation passes despite warning; fix in `content-validator.ts` |

See `docs/known-issues.md` for full list (15 issues).

---

## Rollback Plan

1. **App rollback:** `railway rollback backend --commit <previous>`
2. **DB rollback:** `npx prisma migrate down 1`
3. **Full rollback:** See `docs/beta-rollback-plan.md`

---

## Upgrade & Migration

### From v0.x (if applicable)
```bash
git pull origin main
cd backend
npm ci
npx prisma migrate deploy
npm run build
```

### Seed Commands
```bash
npx ts-node prisma/seed.ts
```

---

## Beta Launch Checklist

[Full checklist → `docs/beta-launch-checklist.md`](docs/beta-launch-checklist.md)

Key items:
1. Railway project created with PostgreSQL + Redis
2. Environment variables set (secrets toggled)
3. Custom domain configured + SSL active
4. Database migrations run
5. Seed data loaded
6. Sentry DSN configured
7. Uptime monitoring active
8. Prometheus metrics accessible
9. Slack webhook for deploy notifications
10. Demo accounts verified

---

## Monitoring

- **Health endpoint:** `GET /health` — checks database, Redis, OpenRouter
- **Metrics endpoint:** `GET /metrics` — Prometheus-formatted (requests, latency, AI cost, DB pool)
- **Error tracking:** Sentry — alerts at >10 errors/5min, >1% error rate/hour
- **Uptime:** Better Uptime — 1-min interval, SSL cert expiry at 14 days

---

## Security

- JWT access tokens (15 min) + refresh tokens (7 days)
- Rate limiting: 60 req/min general, 5 req/min auth
- Content validation: AI responses filtered for blocked categories
- Helmet.js: security headers (HSTS, XSS, nosniff, frame protection)
- Secrets: Railway "Secret" toggle encrypts all sensitive env vars
- CORS: restricted to production origins
- Input validation: class-validator on all DTOs

---

## Production Readiness

| Category | Score | Notes |
|----------|-------|-------|
| AI Quality | 90% | Passes Phase 4 validation (38/38 calls) |
| Infrastructure | 85% | Railway configured; no secondary region |
| Data | 88% | 123 vocab, 45 grammar, 20 scenarios |
| Monitoring | 75% | Sentry + Prometheus; no Grafana dashboard yet |
| Security | 80% | JWT, rate limiting, Helmet; no email verification |
| Speech Features | 0% | Unavailable until API keys configured |
| **Overall** | **84/100** | **GO for beta launch** |

---

## Contributors

- Engineering: @he-team
- AI/ML: OpenRouter (Qwen3-Next 80B A3B Instruct)
- Language Content: AI-generated, validated for schema

---

## Links

- **API:** https://api.he.app/docs
- **Health:** https://api.he.app/health
- **Metrics:** https://api.he.app/metrics
- **Status:** https://status.he.app
- **Repository:** https://github.com/he-platform/he
- **Documentation:** https://he.app/docs

---

## Disclaimer

This is a beta release. AI-generated content may contain inaccuracies. Language content should not be used as the sole source for high-stakes language assessment. Speech features are currently unavailable. Email verification is not yet enforced.
