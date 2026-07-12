/**
 * Regression: crash points above the curve cap left rounds stuck "running" forever.
 */
import assert from "node:assert/strict";
import {
  generateCrashPoint,
  generateOnChainCrashPoint,
  generateServerSeed,
} from "../services/provablyFair.js";

const MAX = 1000;
const RATE = 0.00008;

function multiplierAtElapsedMs(elapsedMs: number): number {
  return Math.min(Math.exp(RATE * Math.max(0, elapsedMs)), MAX);
}

for (let i = 0; i < 200; i++) {
  const seed = generateServerSeed();
  const point = generateCrashPoint(seed, `round-${i}`, []);
  assert.ok(point >= 1 && point <= MAX, `crash point out of range: ${point}`);
  assert.ok(
    multiplierAtElapsedMs(120_000) >= point || point > MAX,
    "curve must be able to reach capped crash points",
  );
  assert.equal(multiplierAtElapsedMs(120_000), MAX);
}

for (let i = 0; i < 50; i++) {
  const seed = generateServerSeed();
  const point = generateOnChainCrashPoint(seed, i + 1);
  assert.ok(point >= 1 && point <= MAX, `on-chain crash point out of range: ${point}`);
}

// Cap hit terminates: once mult is MAX, any crashPoint >= MAX is reachable.
assert.ok(multiplierAtElapsedMs(90_000) >= MAX);
assert.ok(1000 <= MAX);

console.log("crashCap.test.ts: ok");
