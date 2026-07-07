#!/usr/bin/env bash
# Quick smoke test — backend must already be running on PORT (default 3001)
set -euo pipefail

PORT="${PORT:-3001}"
BASE="http://localhost:${PORT}"

echo "🔍 Verifying OrbitCasino at ${BASE}"

health=$(curl -sf "${BASE}/api/health")
echo "✅ /api/health — $(echo "$health" | node -pe "JSON.parse(require('fs').readFileSync(0)).status")"

config=$(curl -sf "${BASE}/api/config")
on_chain=$(echo "$config" | node -pe "JSON.parse(require('fs').readFileSync(0)).onChainEnabled")
cluster=$(echo "$config" | node -pe "JSON.parse(require('fs').readFileSync(0)).cluster")
echo "✅ /api/config — cluster=${cluster}, onChain=${on_chain}"

stats=$(curl -sf "${BASE}/api/casino/stats")
users=$(echo "$stats" | node -pe "JSON.parse(require('fs').readFileSync(0)).totalUsers")
echo "✅ /api/casino/stats — ${users} players"

echo ""
echo "All checks passed. Open http://localhost:5173 (dev) or ${BASE} (prod)."
