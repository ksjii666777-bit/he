#!/bin/bash
set -e
cd backend
npx ts-node prisma/seed.ts
