#!/usr/bin/env bash
# Production smoke test — backend must already be running on PORT (default 3001)
set -euo pipefail

PORT="${PORT:-3001}"
BASE="http://localhost:${PORT}"
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ]; then
    echo "✅ $name ($code)"
  else
    echo "❌ $name — expected $expect, got $code"
    FAIL=1
  fi
}

echo "🔍 OrbitCasino production smoke test — ${BASE}"
echo ""

check "Health" "${BASE}/api/health"
check "Config" "${BASE}/api/config"
check "Casino stats" "${BASE}/api/casino/stats"
check "Leaderboard" "${BASE}/api/leaderboard"
check "Recent wins" "${BASE}/api/recent-wins"
check "Tournament" "${BASE}/api/tournament"

# Fairness (POST) — expect 400 on empty body
fairness_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/fairness/verify-crash" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$fairness_code" = "400" ]; then
  echo "✅ Fairness endpoint (400 on empty body)"
else
  echo "❌ Fairness endpoint — expected 400, got $fairness_code"
  FAIL=1
fi

# Auth required — expect 401 without token
auth_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/user/test")
if [ "$auth_code" = "401" ]; then
  echo "✅ Auth guard (401 without token)"
else
  echo "❌ Auth guard — expected 401, got $auth_code"
  FAIL=1
fi

# Frontend (production mode)
if curl -sf -o /dev/null "${BASE}/" 2>/dev/null; then
  echo "✅ Frontend index (200)"
else
  echo "ℹ️  Frontend not served (dev mode — use :5173)"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "All smoke checks passed."
  node -e "
    const u='${BASE}/api/config';
    fetch(u).then(r=>r.json()).then(c=>{
      console.log('  cluster:', c.cluster);
      console.log('  onChain:', c.onChainEnabled);
      console.log('  paused:', c.casinoPaused);
      console.log('  minBet:', c.minBetSol, 'SOL');
    });
  "
else
  echo "Some checks failed."
  exit 1
fi
