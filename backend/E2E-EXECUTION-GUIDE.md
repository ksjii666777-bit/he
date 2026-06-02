# HE Backend — First E2E Execution Guide (Windows PowerShell)

## Prerequisites

| Requirement | Status | How to verify |
|---|---|---|
| Docker Desktop running | Check `docker ps` shows containers | `docker ps` |
| Node.js v20+ | You have v24.15.0 | `node --version` |
| npm 10+ | You have 11.15.0 | `npm --version` |
| Port 5433 free | PostgreSQL will bind here | `netstat -ano | findstr :5433` |
| Port 6379 free | Redis will bind here | `netstat -ano | findstr :6379` |
| Port 3000 free | Backend will listen here | `netstat -ano | findstr :3000` |

## Environment Variables — Mandatory vs Optional

### Mandatory (app won't start without these)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://he_user:he_dev_password@localhost:5433/he_dev` | Port 5433, not 5432 |
| `JWT_SECRET` | Any 64-char string | Used for signing access tokens |
| `JWT_REFRESH_SECRET` | Any different 64-char string | Used for signing refresh tokens |

### Optional (app starts, specific features use mock fallbacks)

| Variable | Without it | Mock behavior |
|---|---|---|
| `ANTHROPIC_API_KEY` | Lesson generation, conversation, roadmap enhancement throw errors | No mock — these endpoints fail with 500 |
| `OPENAI_API_KEY` | Same as above (Claude fails, OpenAI fallback also fails) | No mock |
| `DEEPGRAM_API_KEY` | Speech transcription uses mock | Returns fake transcription with 5 words |
| `ELEVENLABS_API_KEY` | TTS uses mock | Returns 1-second sine wave WAV |
| `REDIS_URL` | Redis features degrade gracefully | `RedisService.enabled = false`, all ops return null |
| `MONTHLY_HARD_CAP_CENTS` | Defaults to `120000` ($1,200) | — |
| `DAILY_USER_LIMIT_CENTS` | Defaults to `10` ($0.10) | — |

### Endpoints that work WITHOUT AI keys

| Endpoint | Works? |
|---|---|
| `POST /v1/auth/register` | Yes |
| `POST /v1/auth/login` | Yes |
| `POST /v1/auth/refresh` | Yes |
| `POST /v1/auth/logout` | Yes |
| `POST /v1/auth/consent` | Yes |
| `POST /v1/roadmaps` | Yes |
| `GET /v1/roadmaps` | Yes |
| `GET /v1/roadmaps/today` | Yes |
| `GET /learning/placement/generate` | Yes (static questions) |
| `POST /learning/placement/evaluate` | Yes (local scoring) |
| `GET /progress` | Yes |
| `GET /progress/streak` | Yes |
| `GET /progress/daily` | Yes |
| `GET /vocabulary/review` | Yes |
| `POST /vocabulary/review` | Yes |
| `GET /vocabulary/stats` | Yes |
| `POST /speech/pronunciation` | Yes (mock STT) |
| `POST /speech/synthesize` | Yes (mock TTS) |
| `GET /health` | Yes |
| `GET /health/live` | Yes |
| `GET /health/ready` | Yes |

### Endpoints that FAIL without AI keys

| Endpoint | Error |
|---|---|
| `POST /learning/lesson/generate` | `AIProvidersUnavailableError` |
| `POST /learning/roadmap/:id/enhance` | `AIProvidersUnavailableError` |
| WebSocket `conversation:start` | Session created but AI turns fail |
| WebSocket `conversation:message` | `AIProvidersUnavailableError` |

---

## Step 1 — Start Infrastructure

```powershell
cd C:\Users\Karan\OneDrive\Documents\he
docker-compose up -d
```

**Expected output:**
```
[+] Running 3/3
 ✔ Network he_default          Created
 ✔ Container he-postgres       Started (healthy)
 ✔ Container he-redis          Started (healthy)
```

**Wait for health checks:**
```powershell
docker-compose ps
```

**Expected:** Both containers show `healthy` status. If `health` is `starting`, wait 10 seconds and re-run.

**Common failures:**
- `port is already allocated` — Port 5433 or 6379 is in use. Run `netstat -ano | findstr :5433` and `netstat -ano | findstr :6379` to find the process. Kill it or change the port in `docker-compose.yml`.
- `Cannot connect to the Docker daemon` — Start Docker Desktop and wait for the whale icon to stop animating.

---

## Step 2 — Verify Containers Are Healthy

```powershell
# PostgreSQL
docker exec he-postgres pg_isready -U he_user -d he_dev

# Redis
docker exec he-redis redis-cli ping
```

**Expected:**
```
he_dev:5432 - accepting connections
PONG
```

**Common failures:**
- `role "he_user" does not exist` — The `toroloom-postgres` container is on port 5432. Our container is on 5433. Make sure you're connecting to the right one. The docker exec above targets `he-postgres`, not `toroloom-postgres`.

---

## Step 3 — Create `.env` File

```powershell
cd C:\Users\Karan\OneDrive\Documents\he\backend

@"
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://he_user:he_dev_password@localhost:5433/he_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-replace-this-with-64-chars-minimum-in-production-ok
JWT_REFRESH_SECRET=dev-refresh-secret-replace-this-with-64-chars-minimum-ok
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
MONTHLY_HARD_CAP_CENTS=120000
DAILY_USER_LIMIT_CENTS=10
"@ | Out-File -Encoding utf8 .env
```

**Verify:**
```powershell
Get-Content .env
```

**Optional — add AI keys if you have them:**
```powershell
# Only if you want lesson generation, conversation, and roadmap enhancement to work
Add-Content .env "`nANTHROPIC_API_KEY=sk-ant-your-key-here"
Add-Content .env "`nOPENAI_API_KEY=sk-your-key-here"

# Only if you want real speech (not mock)
Add-Content .env "`nDEEPGRAM_API_KEY=your-deepgram-key"
Add-Content .env "`nELEVENLABS_API_KEY=your-elevenlabs-key"
```

---

## Step 4 — Run Prisma Migrations

```powershell
cd C:\Users\Karan\OneDrive\Documents\he\backend

npx prisma generate
```

**Expected:** `✔ Generated Prisma Client`

```powershell
npx prisma migrate dev --name init
```

**Expected:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "he_dev" at "localhost:5433"

✔ Generated Prisma Client
✔ Created migration

Your database is now in sync with your Prisma schema.
```

**Common failures:**
- `P1001: Can't reach database server at localhost:5433` — PostgreSQL container isn't running or isn't healthy. Go back to Step 1.
- `P1000: Authentication failed` — Wrong username/password in DATABASE_URL. The docker-compose uses `he_user` / `he_dev_password`.
- `P1010: Database he_dev does not exist` — The container created it. If it doesn't exist, run: `docker exec -it he-postgres psql -U postgres -c "CREATE DATABASE he_dev;"` then `docker exec -it he-postgres psql -U postgres -c "CREATE USER he_user WITH PASSWORD 'he_dev_password';"` then `docker exec -it he-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE he_dev TO he_user;"`.

---

## Step 5 — Seed Database

```powershell
cd C:\Users\Karan\OneDrive\Documents\he\backend

npx prisma db seed
```

**Expected:**
```
Seeding vocabulary bank...
Seeded 6 vocabulary items
```

**Common failures:**
- `Can't reach database server` — Same as Step 4.

---

## Step 6 — Start Backend

Open a **new** PowerShell window (keep the previous one for Docker):

```powershell
cd C:\Users\Karan\OneDrive\Documents\he\backend

npm run start:dev
```

**Expected output (after ~5 seconds):**
```
[Nest] 12345  - 31/05/2026, 7:30:00 pm     LOG [NestApplication] Application successfully started
[Nest] 12345  - 31/05/2026, 7:30:00 pm     LOG [Bootstrap] Server running on http://localhost:3000
[Nest] 12345  - 31/05/2026, 7:30:00 pm     LOG [Bootstrap] Swagger docs at http://localhost:3000/docs
[Nest] 12345  - 31/05/2026, 7:30:00 pm     LOG [PrismaService] Connected to database
[Nest] 12345  - 31/05/2026, 7:30:00 pm     LOG [RedisService] Connected to Redis
```

**Common failures:**
- `Nest can't resolve dependencies of the ...` — A module import is broken. Run `npx nest build` to check for compilation errors.
- `EADDRINUSE: address already in use :::3000` — Another process is on port 3000. Kill it: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force`.
- `P1001: Can't reach database server` — PostgreSQL container stopped. Restart: `docker-compose up -d`.
- `Redis connection error` — Redis container stopped. The app will start but Redis-dependent features (sessions, caching) won't work.
- `DEEPGRAM_API_KEY not set, using mock STT` — This is a warning, not an error. The app starts fine.
- TypeScript errors on startup — Run `npx nest build` first to see if the build passes. If it does, `start:dev` uses `ts-node` which may have different module resolution.

---

## Step 7 — Run Health Checks

```powershell
# Liveness probe
curl http://localhost:3000/health/live

# Readiness probe
curl http://localhost:3000/health/ready

# Full health
curl http://localhost:3000/health
```

**Expected for `/health/live`:**
```json
{"status":"ok","uptime":5}
```

**Expected for `/health/ready`:**
```json
{"status":"ok","database":"ok"}
```

**Expected for `/health` (without AI keys):**
```json
{
  "status": "degraded",
  "checks": {
    "database": {"status":"ok","latencyMs":2},
    "redis": {"status":"ok"},
    "aiProviders": {"claude":"missing_key","openai":"missing_key"}
  }
}
```

`status: "degraded"` is expected when AI keys are missing. `status: "ok"` requires all AI keys.

---

## Step 8 — Manual Smoke Test

```powershell
# Register a user
$register = curl -s -X POST http://localhost:3000/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"smoke@test.com","password":"Test123!","name":"Smoke Test","age":25,"countryCode":"US","nativeLanguage":"en","learningGoal":"general","dailyStudyMin":15}'
$register

# Extract token
$token = ($register | ConvertFrom-Json).accessToken

# Login
curl -s -X POST http://localhost:3000/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"smoke@test.com","password":"Test123!"}'

# Get profile
curl -s http://localhost:3000/v1/users/me `
  -H "Authorization: Bearer $token"

# Placement test
curl -s http://localhost:3000/learning/placement/generate `
  -H "Authorization: Bearer $token"

# Progress
curl -s http://localhost:3000/progress `
  -H "Authorization: Bearer $token"

# Vocabulary stats
curl -s http://localhost:3000/vocabulary/stats `
  -H "Authorization: Bearer $token"

# Pronunciation (mock)
curl -s -X POST http://localhost:3000/speech/pronunciation `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"referenceText":"hello world","audioBuffer":"aGVsbG8="}'

# TTS (mock)
curl -s -X POST http://localhost:3000/speech/synthesize `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"text":"Hello, welcome to your lesson."}'

# Swagger docs
Start-Process http://localhost:3000/docs
```

All endpoints above should return 200/201 responses without AI keys.

---

## Step 9 — Run E2E Tests

**IMPORTANT:** E2E tests use a separate Jest config and launch a NestJS test server. They will try to connect to PostgreSQL and Redis.

```powershell
cd C:\Users\Karan\OneDrive\Documents\he\backend

npx jest --config ./test/jest-e2e.json --verbose
```

**Expected results WITHOUT AI keys:**
- `App (e2e) > Auth` — 8/8 pass (register, login, refresh, logout, profile)
- `App (e2e) > Consent` — 1/1 pass
- `App (e2e) > Roadmaps` — 4/4 pass
- `App (e2e) > Health` — 1/1 pass
- `Full User Journey > 1. Register` — 3/3 pass
- `Full User Journey > 2. Placement Test` — 2/2 pass
- `Full User Journey > 3. Roadmap` — 3/3 pass
- `Full User Journey > 4. First Lesson` — FAILS (needs AI keys)
- `Full User Journey > 5. Conversation with AI Tutor` — FAILS (needs AI keys)
- `Full User Journey > 6. Pronunciation Feedback` — 2/2 pass
- `Full User Journey > 7. Vocabulary Review` — 3/3 pass
- `Full User Journey > 8. Progress Dashboard` — 3/3 pass
- `Module Integration > AI Gateway` — FAILS (needs AI keys)
- `Module Integration > Speech` — 2/2 pass
- `Module Integration > Learning` — FAILS (needs AI keys)
- `Module Integration > Progress` — 2/2 pass
- `Module Integration > Roadmap` — FAILS (needs AI keys)

**With AI keys:** All tests should pass (30+ pass, WebSocket tests may be flaky due to timing).

**Common failures:**
- `ECONNREFUSED 127.0.0.1:5433` — PostgreSQL isn't running. Go back to Step 1.
- `ECONNREFUSED 127.0.0.1:6379` — Redis isn't running. Go back to Step 1.
- `PrismaClientKnownRequestError` — Database schema doesn't match. Re-run `npx prisma migrate dev --name init`.
- WebSocket timeout — The conversation tests use `socket.io-client` and have 10-15 second timeouts. If the server is slow, these may time out. This is expected in development.

---

## Step 10 — Run Unit Tests (Regression Check)

```powershell
cd C:\Users\Karan\OneDrive\Documents\he\backend

npx jest --config ./test/jest-unit.json --verbose --testPathPattern "(recovery|quality|cost)" --testPathIgnorePatterns "e2e"
```

**Expected:** 57/57 pass, 0 fail.

**If e2e tests are included by the regex**, add this filter:
```powershell
npx jest --config ./test/jest-unit.json --testPathPattern "test/(recovery|quality|cost)/" --verbose
```

---

## Troubleshooting Quick Reference

| Problem | Fix |
|---|---|
| `docker-compose up` fails with port conflict | Change port in docker-compose.yml (e.g., `5434:5432`) |
| `prisma migrate dev` fails with connection error | Verify container health: `docker exec he-postgres pg_isready -U he_user -d he_dev` |
| Backend won't start — dependency resolution error | Run `npx nest build` to check for compilation errors |
| `EADDRINUSE: 3000` | `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess \| Stop-Process -Force` |
| E2E auth tests fail with 401 | Check JWT_SECRET is set in .env and matches between server start and test |
| E2E lesson generation fails | Expected without AI keys. Add ANTHROPIC_API_KEY to .env |
| WebSocket tests timeout | Increase timeout or check server logs for errors |
| `Cannot find module '@prisma/client'` | Run `npx prisma generate` |
| `Error: Cannot find module '../src/app.module'` | Run `npx nest build` first, or check tsconfig paths |
| Redis connection warning in logs | Expected if Redis is down. Features degrade gracefully. |

---

## What Runs at Each Stage

| Stage | PostgreSQL | Redis | AI Keys | Backend | Tests |
|---|---|---|---|---|---|
| Step 1-2 | Started | Started | No | — | — |
| Step 3-5 | Running | Running | No | — | — |
| Step 6 | Running | Running | No | Started | — |
| Step 7 | Running | Running | No | Running | Health checks |
| Step 8 | Running | Running | No | Running | Manual smoke |
| Step 9 | Running | Running | Optional | Running | E2E (partial) |
| Step 10 | Running | Running | No | — | Unit only |

## Summary

After Step 8 you have a working backend with:
- Auth (register, login, refresh, logout, consent)
- Roadmaps (create, get, today plan)
- Placement test (generate, evaluate)
- Progress tracking (dashboard, streak, daily)
- Vocabulary (review, stats)
- Speech (pronunciation scoring, TTS — mock)
- Health checks

Without AI keys, lesson generation, conversation, and roadmap enhancement are unavailable. These require real Anthropic or OpenAI API keys in `.env`.
