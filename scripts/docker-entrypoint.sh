#!/usr/bin/env bash
set -euo pipefail

if [ "${NODE_ENV:-production}" = "production" ]; then
  if [ -z "${JWT_SECRET:-}" ] || [[ "${JWT_SECRET}" == dev-only-change-in-production* ]]; then
    echo "ERROR: JWT_SECRET must be set for production."
    echo ""
    echo "  1. Run: npm run setup   (generates backend/.env with JWT_SECRET)"
    echo "  2. Or set JWT_SECRET in backend/.env before: docker compose up"
    echo ""
    exit 1
  fi
fi

# EFS data dir — backups and ops.log live under /app/backend/data/backups
mkdir -p /app/backend/data/backups

exec node backend/dist/index.js
