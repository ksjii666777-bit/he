# Production Deployment Guide

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Cloudflare  │────▶│  Railway CDN  │────▶│  NestJS API  │
│  (DNS, WAF)  │     │  (SSL edge)   │     │  (2 replicas) │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                    ┌───────────────────────────┼───────────┐
                    │                           │           │
              ┌─────▼──────┐          ┌────────▼──────┐   │
              │ PostgreSQL  │          │    Redis      │   │
              │ (Railway)   │          │  (Railway)    │   │
              └────────────┘          └───────────────┘   │
                    │                                      │
              ┌─────▼─────────────────────────────────────▼──┐
              │             OpenRouter AI                    │
              │  (Qwen3-Next 80B A3B → Claude Haiku fallback) │
              └──────────────────────────────────────────────┘
```

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository (connected to Railway)
- OpenRouter API key (https://openrouter.ai/keys)
- Sentry account (https://sentry.io) — optional but recommended
- Domain name (e.g., `he.app`)

---

## Step 1: Project Setup on Railway

### 1a. Create Project
1. Log in to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select `he` repository
4. Railway auto-detects Nixpacks from `nixpacks.toml`

### 1b. Add Services
From Railway project dashboard, click **"New"** → **"Add Service"**:

| Service | Type | Source | Notes |
|---------|------|--------|-------|
| `backend` | GitHub repo (Nixpacks) | `backend/` | Main API server |
| `postgres` | Database → PostgreSQL | Railway add-on | 1 GB plan |
| `redis` | Database → Redis | Railway add-on | 250 MB plan |

### 1c. Configure Service Settings

**Backend service settings:**
| Setting | Value |
|---------|-------|
| Build Command | `cd backend && npm ci && npx prisma generate && npm run build` |
| Start Command | `cd backend && npx prisma migrate deploy && node dist/src/main.js` |
| Healthcheck Path | `/health` |
| Healthcheck Timeout | 30s |
| Restart Policy | On failure, max 10 retries |
| Replicas | `2` (minimum) — can scale to 4+ as traffic grows |

---

## Step 2: Environment Variables

### 2a. Set Variables in Railway

Navigate to **backend → Variables**.

Set these manually (or use Railway's "Raw Editor" to paste the contents of `backend/.env.production`):

| Variable | Source | Notes |
|----------|--------|-------|
| `NODE_ENV` | Fixed | `production` |
| `PORT` | Fixed | `3000` |
| `DATABASE_URL` | Railway auto-inject | From PostgreSQL add-on |
| `REDIS_URL` | Railway auto-inject | From Redis add-on |
| `JWT_SECRET` | Generate | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Generate | `openssl rand -base64 64` |
| `OPENROUTER_API_KEY` | OpenRouter | Secret; never commit |
| `SENTRY_DSN` | Sentry project | Optional |
| `DEEPGRAM_API_KEY` | Deepgram | Optional (speech features) |
| `ELEVENLABS_API_KEY` | ElevenLabs | Optional (speech features) |
| `SENDGRID_API_KEY` | SendGrid | Optional (email) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | Optional (OAuth) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Optional (OAuth) |

> **IMPORTANT**: Mark all secrets with ✅ **"Secret"** toggle in Railway variable editor so they are encrypted at rest and masked in logs.

### 2b. Reference vs. Fixed Variables
Railway PostgreSQL add-on auto-injects `DATABASE_URL` and `RAILWAY_DATABASE_URL`.
Railway Redis add-on auto-injects `REDIS_URL` and `RAILWAY_REDIS_URL`.
Do NOT manually set these unless overriding defaults.

---

## Step 3: Custom Domain

1. Go to **backend → Settings → Domains**
2. Click **"Custom Domain"** → enter `api.he.app`
3. Railway provisions Let's Encrypt SSL automatically
4. Add CNAME record at your DNS provider:
   ```
   api.he.app → he-production.up.railway.app
   ```
5. Wait for domain status to show **"SSL Active"**

See `docs/domain-ssl-setup.md` for full domain and SSL details.

---

## Step 4: Deploy

### First Deploy
```bash
# Trigger from GitHub
git push origin main
```
Or use Railway CLI:
```bash
railway login
railway link
railway up --service backend
```

### Verify Deployment
```bash
# Health check
curl https://api.he.app/health

# Expected response:
{
  "status": "ok",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "openrouter": "healthy"
  },
  "version": "1.0.0-rc.1",
  "timestamp": "2026-06-01T12:00:00.000Z"
}

# Run database migrations (if not in start command)
cd backend && npx prisma migrate deploy
```

---

## Step 5: Seed Production Data

```bash
# SSH into Railway service or run via Railway CLI
railway run --service backend "npx prisma migrate deploy"
railway run --service backend "npx ts-node prisma/seed.ts"
```

> **Production seed** creates: 123 vocabulary entries, 45 grammar lessons, 20 conversation scenarios, and 3 demo accounts. Do NOT skip this step.

---

## Step 6: Monitoring

### Set up Sentry
1. Create project: https://sentry.io/organizations/YOUR_ORG/projects/new/
2. Set `SENTRY_DSN` in Railway variables
3. Deploy; verify errors appear in Sentry dashboard within 60s

### Set up Uptime Monitoring
Register at [Better Uptime](https://betteruptime.com) (free tier) or [Pingdom](https://pingdom.com):
- Monitor URL: `https://api.he.app/health`
- Check interval: 1 minute
- Alert on 2 consecutive failures
- SSL cert check: alert at 14 days before expiry

### Prometheus + Grafana (Optional)
1. Add a Prometheus `scrape_config` target:
```yaml
scrape_configs:
  - job_name: 'he-backend'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['api.he.app:3000']
```
2. Import Grafana dashboard (JSON template at `infra/grafana/he-dashboard.json` — to be created after beta)

---

## Step 7: Post-Deploy Verification

### Smoke Tests
```bash
# 1. Health
curl https://api.he.app/health

# 2. Register
curl -X POST https://api.he.app/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","name":"Test User"}'

# 3. Login
curl -X POST https://api.he.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# 4. Generate lesson (with JWT token)
curl -X POST https://api.he.app/v1/learning/lesson/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cefrLevel":"A1","topic":"Travel","nativeLanguage":"en"}'

# 5. Metrics
curl https://api.he.app/metrics
```

### Database Verification
```bash
# Count seeded data
railway run --service backend "psql $DATABASE_URL -c 'SELECT count(*) FROM \"VocabularyBank\";'"
railway run --service backend "psql $DATABASE_URL -c 'SELECT count(*) FROM grammar_lessons;'"
railway run --service backend "psql $DATABASE_URL -c 'SELECT count(*) FROM conversation_scenarios;'"
```

---

## Scaling Guide

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU > 70% for 10 min | Add replica (3 → 4) |
| RAM > 80% | Upgrade instance (2 GB → 4 GB) |
| DB connections > 80% of pool | Increase pool size + replica count |
| AI latency > 10s p95 | Add fallback model, reduce timeout |
| Error rate > 2% | Investigate + rollback if needed |

### Railway Scaling
```bash
# Scale replicas via CLI
railway scale backend --replicas 3

# Scale instance size in dashboard
# Backend Settings → Deployment → Instance Type: from "Small" to "Medium"
```

---

## Rollback Procedure

1. **Re-deploy previous version:**
   ```bash
   railway rollback backend --commit <previous-commit-hash>
   ```

2. **Database rollback:**
   ```bash
   cd backend
   npx prisma migrate down 1
   ```

3. **Full rollback plan:** See `docs/beta-rollback-plan.md`

---

## Deployment Checklist Summary

- [ ] Railway project created
- [ ] PostgreSQL + Redis add-ons provisioned
- [ ] Environment variables set (secrets toggled)
- [ ] Custom domain configured + SSL active
- [ ] First deploy successful (`/health` returns 200)
- [ ] Database migrations run
- [ ] Seed data loaded
- [ ] Sentry DSN configured + verified
- [ ] Uptime monitoring active
- [ ] Prometheus metrics accessible (`/metrics`)
- [ ] Slack webhook for deploy notifications configured
- [ ] 3 demo accounts verified
- [ ] E2E smoke tests pass
