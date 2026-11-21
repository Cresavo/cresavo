#!/usr/bin/env bash
# Build for the public demo project (vercel.json). Vercel limits buildCommand to
# 256 characters, so the steps live here.
set -euo pipefail

# Prisma client generation only; the demo has no runtime database. The public
# flags are fixed here so a project environment variable cannot override them.
export DATABASE_URL=postgresql://build@127.0.0.1:1/build_test
export NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO=1
export NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN=cresavo.com

# The hosted pairing preview applies its pending migrations through the direct connection.
if [ "${ASSISTANT_PAIRING:-}" = 1 ] && [ -n "${PAIRING_DATABASE_URL_UNPOOLED:-}" ]; then
  npx prisma migrate deploy --config prisma.pairing.config.ts
fi

npx prisma generate
npx next build
