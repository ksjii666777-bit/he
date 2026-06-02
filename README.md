# HE — AI Language Learning Platform

## Prerequisites

- Node.js 20+
- Docker Desktop
- Git

## Quick Start

```bash
# 1. Install dependencies
cd backend && npm install && cd ..

# 2. Start infrastructure
docker compose up -d

# 3. Run database migrations
cd backend && npx prisma migrate dev --name init

# 4. Seed data
npx ts-node prisma/seed.ts

# 5. Start backend
npm run start:dev
```

## Architecture

- **Monolith:** NestJS (backend/)
- **Mobile:** Flutter (mobile/)
- **Database:** PostgreSQL 16 + Redis 7
- **Deployment:** Railway/Render

## Project Structure

```
he/
├── backend/       # NestJS API server
├── mobile/        # Flutter app
├── infra/         # Docker, CI/CD configs
├── docs/          # Architecture docs
└── docker-compose.yml
```

## API Docs

http://localhost:3000/docs (Swagger UI)
