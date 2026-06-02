# Beta Rollback Plan — v1.0

## Triggers for Rollback

| Severity | Criteria | Action |
|----------|----------|--------|
| **Critical** | > 10% 5xx error rate for > 5 minutes | Immediate rollback |
| **Critical** | Data loss or corruption detected | Immediate rollback, restore from backup |
| **Critical** | AI provider unavailable for > 15 minutes | Rollback to mock mode |
| **High** | > 20% of users report conversation failures | Rollback within 1 hour |
| **High** | Monthly AI spend exceeds 50% of cap in first week | Rollback, reduce model quality |
| **Medium** | Registration/login broken for > 10 minutes | Rollback |
| **Medium** | Lesson generation > 30s for > 5% of requests | Rollback, reduce model tier |

## Rollback Process

### Step 1: Detection & Assessment
1. Automated monitoring alerts (health endpoint, error rate, cost spike)
2. Engineering lead assesses severity within 2 minutes
3. Decision: rollback or mitigate in-place

### Step 2: Communication
1. Announce incident in #engineering channel
2. Notify beta testers via in-app notification (if possible)
3. Estimated time to resolution communicated

### Step 3: Execute Rollback

#### Option A: Feature Flag (preferred)
- All new features behind feature flags
- Disable unstable feature → system returns to last stable state
- No deployment required
- Time: < 1 minute

#### Option B: Deploy Previous Version
```bash
# 1. Fetch previous stable image
docker pull ghcr.io/he-app/backend:stable

# 2. Stop current container
docker stop he-api

# 3. Start previous version
docker run -d --name he-api-stable \
  --env-file .env.production \
  -p 3000:3000 \
  ghcr.io/he-app/backend:stable

# 4. Verify health
curl http://localhost:3000/health

# 5. Switch traffic (if behind load balancer)
# Update load balancer target group to point at stable container
```

#### Option C: Database Rollback
```bash
# 1. Stop API to prevent writes
docker stop he-api

# 2. Restore database from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --clean --if-exists \
  /backups/he-db-$(date -d "1 hour ago" +%Y-%m-%d-%H).dump

# 3. Restart API with pinned version
docker run -d --name he-api-pinned \
  --env-file .env.production \
  -p 3000:3000 \
  ghcr.io/he-app/backend:previous-stable

# 4. Verify data integrity
```

### Step 4: Verify Rollback
1. Health endpoint returns `ok`
2. E2E smoke tests pass (register → lesson → conversation)
3. Error rate returns to baseline
4. AI cost tracking shows no anomalous spend

### Step 5: Post-Mortem
1. Root cause analysis within 24 hours
2. Bug fix with test coverage
3. Update rollback plan if gaps found
4. Communicate findings to team

## Rollback Testing

### Scheduled Rollback Drills
- **Monthly**: Full rollback drill (deploy → detect → rollback → verify)
- **Quarterly**: Database restore drill

### Drill Checklist
- [ ] Rollback script tested on staging
- [ ] Previous Docker image available
- [ ] Database backup verified restorable
- [ ] Team members know their rollback role
- [ ] Communication template prepared

## Database Backup Strategy

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Continuous WAL archiving | Every 5 min | 7 days | S3 |
| Daily full backup | Daily at 02:00 UTC | 30 days | S3 |
| Weekly full backup | Sunday 02:00 UTC | 6 months | S3 cold storage |

## Communication Templates

### Incident Started
> 🚨 [SEVERITY] Incident detected on HE Beta
> Time: [TIMESTAMP]
> Impact: [DESCRIPTION]
> Status: Investigating / Mitigating / Resolved
> ETA: [ESTIMATED FIX TIME]

### Rollback Initiated
> 🔄 Rolling back HE Beta to previous stable version
> Reason: [REASON]
> Expected downtime: [DURATION]
> Affected users: [COUNT]

### All Clear
> ✅ HE Beta incident resolved
> Duration: [DURATION]
> Root cause: [CAUSE]
> Action items: [BUG TRACKER LINKS]
