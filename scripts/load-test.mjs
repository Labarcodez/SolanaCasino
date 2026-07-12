#!/usr/bin/env node
/**
 * Lightweight load test — no k6 required.
 * Usage: node scripts/load-test.mjs [url] [concurrency] [durationSec]
 * Example: node scripts/load-test.mjs https://orbit-casino.com 20 30
 */
const base = (process.argv[2] ?? process.env.PRODUCTION_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);
const concurrency = Math.max(1, Number(process.argv[3] ?? 10));
const durationSec = Math.max(5, Number(process.argv[4] ?? 20));

const endpoints = ["/api/health", "/api/config", "/api/casino/stats"];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function hit(path) {
  const start = performance.now();
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10_000) });
  const ms = performance.now() - start;
  return { ok: res.ok, status: res.status, ms, path };
}

async function worker(until, latencies, errors) {
  while (Date.now() < until) {
    const path = endpoints[Math.floor(Math.random() * endpoints.length)];
    try {
      const result = await hit(path);
      latencies.push(result.ms);
      if (!result.ok) errors.push(`${path} ${result.status}`);
    } catch (err) {
      errors.push(`${path} ${err instanceof Error ? err.message : err}`);
    }
  }
}

console.log(`Load test — ${base}`);
console.log(`  concurrency: ${concurrency}, duration: ${durationSec}s\n`);

const until = Date.now() + durationSec * 1000;
const latencies = [];
const errors = [];

await Promise.all(Array.from({ length: concurrency }, () => worker(until, latencies, errors)));

latencies.sort((a, b) => a - b);
const total = latencies.length;
const okRate = total > 0 ? ((total - errors.length) / total) * 100 : 0;

console.log(`Requests: ${total}`);
console.log(`Errors:   ${errors.length}`);
if (errors.length > 0 && errors.length <= 5) {
  for (const e of errors) console.log(`  - ${e}`);
} else if (errors.length > 5) {
  console.log(`  - ${errors.slice(0, 3).join("\n  - ")}`);
  console.log(`  ... and ${errors.length - 3} more`);
}
console.log(`Latency ms — p50: ${percentile(latencies, 50).toFixed(0)}, p95: ${percentile(latencies, 95).toFixed(0)}, max: ${(latencies[latencies.length - 1] ?? 0).toFixed(0)}`);

const failThreshold = errors.length > total * 0.05;
if (failThreshold) {
  console.error("\nLoad test FAILED (>5% errors)");
  process.exit(1);
}
console.log("\nLoad test passed.");
process.exit(0);
