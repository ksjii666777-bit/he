# Monitoring & Backup Checklist

## 1. Monitoring Setup

### Infrastructure Monitoring (Railway Dashboard)
- [ ] **RAM Usage** — alert if > 80% for 5+ minutes
- [ ] **CPU Usage** — alert if > 70% sustained
- [ ] **Disk I/O** — watch for throttling (Railway provides NVMe)
- [ ] **Network In/Out** — monitor for unexpected traffic spikes
- [ ] **Restart Count** — alert if > 2 restarts in 1 hour
- [ ] **Uptime** — target 99.9% (43m downtime/month allowed)

### Application Monitoring (Sentry)
- [ ] Error tracking configured (`SENTRY_DSN` in env)
- [ ] Sample rate = 0.1 (trace 10% of requests)
- [ ] Custom alert: >= 10 errors in 5 minutes → Slack/PagerDuty
- [ ] Custom alert: >= 1% error rate in 1 hour
- [ ] Performance tracing enabled for key endpoints:
  - `POST /v1/learning/lesson/generate`
  - `POST /v1/learning/conversation/start`
  - `POST /v1/auth/register`
- [ ] Source maps uploaded for readable stack traces

### Prometheus Metrics (Port 3000, /metrics)
- [ ] `he_http_requests_total` — request count by method/status/path
- [ ] `he_http_request_duration_seconds` — latency histogram (p50/p95/p99)
- [ ] `he_ai_calls_total` — OpenRouter calls by model/status
- [ ] `he_ai_latency_seconds` — AI response time histogram
- [ ] `he_ai_cost_cents_total` — cumulative AI cost
- [ ] `he_db_pool_connections` — active/idle/waiting Prisma connections
- [ ] `he_db_query_duration_seconds` — query latency histogram
- [ ] `he_redis_operations_total` — Redis op count by command
- [ ] `he_active_users_gauge` — distinct users in last 15 min
- [ ] `he_monthly_cost_cents` — monthly AI spend
- [ ] Prometheus target configured in Railway → TCP routing on port 3000

### Uptime Monitoring (Better Uptime / Pingdom / UptimeRobot)
- [ ] URL: `https://api.he.app/health` — every 1 minute
- [ ] Expected: HTTP 200, body contains `{status: "ok"}`
- [ ] Alert on 2 consecutive failures
- [ ] SSL certificate expiry check (alert at 14 days)
- [ ] Public status page: `status.he.app`

### Log Management
- [ ] Railway logs accessible via dashboard (7-day retention)
- [ ] Structured JSON logging configured in NestJS
- [ ] Key log events:
  - User registration + email verification
  - Lesson generation start/complete
  - Conversation session start/end
  - AI provider errors + fallback activation
  - Cost limit reached
  - Rate limit exceeded (429 responses)
  - Authentication failures (401/403)

### Alerts (PagerDuty / Slack)
- [ ] **P1 (Critical)** — Sentry error rate > 5%, API unavailable > 2 min
- [ ] **P2 (High)** — AI latency > 15s p95, DB pool exhaustion, cost cap approaching 80%
- [ ] **P3 (Medium)** — Monthly cost near cap, Redis latency > 200ms
- [ ] **P4 (Low)** — SSL cert expiring, disk usage > 80%

---

## 2. Backup Strategy

### Database Backups (PostgreSQL)

| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Full | Daily (0200 UTC) | 30 days | `pg_dump` → S3 |
| WAL | Continuous | 7 days | PostgreSQL WAL archiving |
| Snapshot | Weekly (Sunday 0300 UTC) | 3 months | Railway PG add-on snapshot |

Automated backup script (`infra/scripts/backup-db.sh`):
```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date -u +%Y%m%dT%H%M%S)
BACKUP_FILE="he-backup-${TIMESTAMP}.sql.gz"
S3_BUCKET="he-app-backups"
S3_PATH="postgres/${BACKUP_FILE}"

pg_dump --no-owner --no-acl \
  "$DATABASE_URL" | gzip | \
  aws s3 cp - "s3://${S3_BUCKET}/${S3_PATH}"

# Notify
aws sns publish \
  --topic-arn "arn:aws:sns:us-east-1:ACCOUNT:he-backups" \
  --message "PostgreSQL backup uploaded: s3://${S3_BUCKET}/${S3_PATH}"
```

### Redis Backups (AOF + RDB)

| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| RDB snapshot | Every 5 min (configurable) | 24 hours | Redis auto-save (`save 300 1`) |
| AOF log | Every 1 second | 7 days | Append-only file persistence |
| Manual dump | Daily | 30 days | `BGSAVE` + S3 upload |

Redis persistence config:
```
save 900 1       # 1 change in 15 min
save 300 10      # 10 changes in 5 min
save 60 10000    # 10000 changes in 1 min
appendonly yes
appendfsync everysec
```

### Application Backups
- [ ] `.env.production` stored in encrypted vault (Bitwarden / 1Password)
- [ ] Prisma migration files committed to git
- [ ] Seed data committed to `prisma/seed.ts`
- [ ] Prometheus metrics data not backed up (ephemeral)
- [ ] Sentry data retained by Sentry (90-day default)

### S3 Backup Structure
```
s3://he-app-backups/
├── postgres/
│   ├── he-backup-20260601T020000.sql.gz
│   └── he-backup-20260602T020000.sql.gz
├── redis/
│   └── dump-20260601.rdb
└── config/
    └── env.production.encrypted
```

---

## 3. Backup Restoration

### Restore PostgreSQL
```bash
# Download latest backup
aws s3 cp "s3://he-app-backups/postgres/he-backup-$(date -u +%Y%m%d)T020000.sql.gz" - | \
  gunzip | psql "$DATABASE_URL"

# Verify
psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

### Restore Redis
```bash
# Stop Redis, replace dump.rdb, restart
cp /path/to/downloaded/dump.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl restart redis
```

### Point-in-Time Recovery (PostgreSQL WAL)
```bash
# Restore to specific time
pg_restore --dbname="$DATABASE_URL" --time-target="2026-06-01 14:30:00 UTC"
```

---

## 4. DR Plan

| Scenario | RTO | RPO | Action |
|----------|-----|-----|--------|
| Single instance crash | < 30s | 0 | Railway auto-restarts; replica takes over |
| Whole region failure | < 5 min | < 5 min | Deploy to secondary Railway region |
| Database corruption | < 30 min | < 24 h | Restore from latest daily backup |
| Accidental data deletion | < 1 h | < 1 min | PITR from WAL logs |
| Full cloud provider outage | < 4 h | < 24 h | Deploy to Render/Fly backup using `BACKUP_DATABASE_URL` |

---

## 5. Cost Monitoring

| Service | Estimated Monthly | Alert Threshold |
|---------|------------------|-----------------|
| Railway (2 vCPU, 4 GB, 2 replicas) | $25–$50 | > $60 |
| Railway PostgreSQL (1 GB) | $5–$10 | Included |
| Railway Redis (250 MB) | $5–$10 | Included |
| OpenRouter AI | $30–$150 | > $200 (monthly cap: $1,200) |
| Sentry (Team plan) | $26/seat | - |
| Deepgram STT | $0–$50 | Based on usage |
| S3 Storage | < $1 | - |
| **Total** | **$67–$271** | > $300 |

---

## 6. On-Call Rotation

- **Business hours (Mon–Fri, 9–5 ET):** Engineering team on Slack
- **After hours:** PagerDuty rotation (weekly shift)
- **Escalation:** 15 min → 30 min → 60 min → Founder
- **Runbook:** Linked in PagerDuty incident (refer to rollback plan)

Add to `CONTRIBUTING.md`:
```
## On-Call
If alerted for a production incident:
1. Ack the PagerDuty alert
2. Check Railway Dashboard for infra issues
3. Check Sentry for error spike
4. Check Prometheus for metric anomalies
5. Follow the rollback plan if needed
```
