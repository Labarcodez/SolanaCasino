#!/usr/bin/env node
/**
 * Cross-platform production smoke — no local server required.
 * Usage: node scripts/verify-production.mjs [https://orbit-casino.com]
 */
const base = (process.argv[2] ?? process.env.PRODUCTION_URL ?? "https://orbit-casino.com").replace(
  /\/$/,
  "",
);

const checks = [];
let failed = 0;

async function get(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { url, status: res.status, ok: res.ok, json, text, headers: res.headers };
}

function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failed += 1;
  checks.push({ name, ok: false, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log(`🔍 Production verify — ${base}\n`);

try {
  const health = await get("/api/health");
  if (health.ok && health.json?.status) {
    pass("Health", health.json.status);
  } else {
    fail("Health", `status ${health.status}`);
  }

  const config = await get("/api/config");
  if (config.ok && config.json) {
    const c = config.json;
    pass("Config", `cluster=${c.cluster}`);
    if (typeof c.limboMinTarget === "number" && c.limboMinTarget >= 2) {
      pass("Limbo min target", `${c.limboMinTarget}x`);
    } else {
      fail("Limbo min target", `expected >= 2, got ${c.limboMinTarget}`);
    }
    if (c.socialLoginEnabled) {
      pass("Phantom social login", "configured");
    } else {
      console.log("ℹ️  Phantom social login not configured (PHANTOM_APP_ID unset)");
    }
  } else {
    fail("Config", `status ${config.status}`);
  }

  for (const path of ["/api/leaderboard", "/api/tournament", "/api/casino/stats"]) {
    const res = await get(path);
    if (res.ok) pass(`GET ${path}`);
    else fail(`GET ${path}`, `status ${res.status}`);
  }

  const index = await get("/");
  if (index.ok && index.text.includes("Orbit")) {
    pass("Frontend index");
  } else {
    fail("Frontend index", `status ${index.status}`);
  }

  const og = await get("/og-image.png");
  const ogType = og.headers.get("content-type") ?? "";
  if (og.ok && ogType.includes("image")) {
    pass("og-image.png");
  } else {
    fail("og-image.png", `status ${og.status} type=${ogType}`);
  }

  const fairness = await fetch(`${base}/api/fairness/verify-crash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  if (fairness.status === 400) {
    pass("Fairness guard", "400 on empty body");
  } else {
    fail("Fairness guard", `expected 400, got ${fairness.status}`);
  }
} catch (err) {
  fail("Network", err instanceof Error ? err.message : String(err));
}

console.log("");
if (failed === 0) {
  console.log("All production checks passed.");
  process.exit(0);
}
console.error(`${failed} check(s) failed.`);
process.exit(1);
