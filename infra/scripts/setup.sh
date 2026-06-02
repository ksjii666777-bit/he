#!/bin/bash
set -e

echo "=== HE Platform Setup ==="

command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx required"; exit 1; }

echo "-> Installing backend dependencies..."
cd backend
npm install

echo "-> Generating Prisma client..."
npx prisma generate

echo "-> Starting PostgreSQL + Redis..."
docker compose up -d postgres redis

echo "-> Waiting for database..."
until docker compose exec postgres pg_isready -U he_user -d he_dev; do
  sleep 2
done

echo "-> Running database migrations..."
npx prisma migrate dev --name init

echo "-> Seeding initial data..."
npx ts-node prisma/seed.ts

echo ""
echo "=== Setup Complete ==="
echo "Backend: http://localhost:3000"
echo "Swagger: http://localhost:3000/docs"
echo "Start backend: cd backend && npm run start:dev"
