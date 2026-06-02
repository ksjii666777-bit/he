# Beta Launch Checklist — v1.0

## Pre-Launch (T-7 days)

### Infrastructure
- [ ] Docker Compose starts all services (PostgreSQL, Redis, API)
- [ ] CI pipeline passes (lint → test → build)
- [ ] Deploy pipeline deploys to staging environment
- [ ] Staging database seeded with vocabulary bank (6+ words)
- [ ] Redis accessible from API container
- [ ] Health endpoint returns `ok` for all checks

### Configuration
- [ ] All 34 env vars configured in staging
- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `OPENAI_API_KEY` set and valid
- [ ] `DEEPGRAM_API_KEY` set and valid (or mock mode documented)
- [ ] `ELEVENLABS_API_KEY` set and valid (or mock mode documented)
- [ ] `JWT_SECRET` set to strong production value
- [ ] `JWT_REFRESH_SECRET` set to strong production value
- [ ] `BETA_INVITE_CODES` set with unique codes for each tester
- [ ] `MONTHLY_HARD_CAP_CENTS` set to appropriate value
- [ ] CORS origin restricted to beta app URL

### Testing
- [ ] E2E user journey passes (register → progress dashboard)
- [ ] All unit tests pass (`npm test`)
- [ ] All quality tests pass
- [ ] Cost model validation completes (projected < $799/month)
- [ ] Circuit breaker tests pass
- [ ] Rate limiter blocks excessive auth requests
- [ ] WebSocket conversation flow works end-to-end

### Monitoring
- [ ] Health endpoint returns all services green
- [ ] Metrics endpoint accessible
- [ ] Error tracking captures 4xx and 5xx responses
- [ ] AI cost tracking operational
- [ ] Monthly cost alert configured at 80%

## Launch Day (T-0)

### Rollout
- [ ] Database migration run
- [ ] API deployed with zero-downtime strategy
- [ ] Invite codes distributed to beta testers (20-50 users)
- [ ] Welcome email sent with onboarding instructions
- [ ] Bug report channel announced (Slack / in-app feedback)

### Verification
- [ ] First beta tester registers and completes placement
- [ ] First lesson generated and completed
- [ ] Conversation WebSocket connects and responds
- [ ] Pronunciation endpoint returns scores
- [ ] Progress dashboard displays data
- [ ] Feedback endpoint accepts submissions
- [ ] Health dashboard shows green status
- [ ] Cost tracking shows $0 spend (initial)

## Post-Launch (T+1 to T+30 days)

### Daily
- [ ] Check health endpoint
- [ ] Review error logs for unhandled exceptions
- [ ] Monitor monthly AI spend
- [ ] Check rate limiter is not blocking legitimate users

### Weekly
- [ ] Review feedback submissions
- [ ] Analyze DAU trend
- [ ] Review lesson completion rates
- [ ] Check pronunciation improvement metrics
- [ ] Review conversation minutes
- [ ] Triage bugs from bug backlog
- [ ] Update cost model projections

### T+30 Days
- [ ] Measure Day 30 retention
- [ ] Measure speaking improvement (starting pronunciation vs current)
- [ ] Evaluate North Star metric
- [ ] Decide: continue beta → open launch → pivot

## Launch Criteria (Gates)

### Gate 1: System Stability (T-7)
- [ ] Health endpoint: all services ok
- [ ] E2E tests: 100% pass rate
- [ ] Load tests: auth < 5% error at 100 VUs, mixed < 10% at 25 VUs
- [ ] Error rate (5xx): < 1% on staging

### Gate 2: User Experience (T-3)
- [ ] Registration flow: < 3 steps
- [ ] Placement test: generates within 3s
- [ ] First lesson: generates within 10s
- [ ] Conversation: AI responds within 5s
- [ ] Pronunciation feedback: returns within 3s

### Gate 3: Cost Control (T-1)
- [ ] Monthly projected cost: < $799
- [ ] Cost guard blocks at $1,200 cap
- [ ] Daily user limit: $0.10/user enforced
- [ ] Anomaly detection: active

### Gate 4: Business Readiness (T-0)
- [ ] 20+ beta testers confirmed
- [ ] Rollback plan documented
- [ ] Bug tracking process in place
- [ ] Support contact established
