import assert from "node:assert/strict";
import {
  generateCrashPoint,
  generateServerSeed,
  hashServerSeed,
  verifyCrashPoint,
  generateCoinflipResult,
} from "../services/provablyFair.js";

const serverSeed = generateServerSeed();
const roundId = "test-round-1";
const crashPoint = generateCrashPoint(serverSeed, roundId, []);
const hash = hashServerSeed(serverSeed);

assert.ok(crashPoint >= 1.0, "crash point should be >= 1.0");
assert.ok(
  verifyCrashPoint(serverSeed, hash, roundId, [], crashPoint),
  "crash verification should pass",
);
assert.ok(
  !verifyCrashPoint(serverSeed, hash, roundId, [], crashPoint + 1),
  "wrong crash point should fail",
);

const betId = "bet-1";
const clientSeed = "client-seed";
const flip = generateCoinflipResult(serverSeed, betId, clientSeed);
assert.ok(flip === "heads" || flip === "tails", "coinflip should be heads or tails");

console.log("✅ All provably fair tests passed");
console.log(`   Sample crash point: ${crashPoint}x`);
