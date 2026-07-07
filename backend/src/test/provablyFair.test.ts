import assert from "node:assert/strict";
import {
  generateCrashPoint,
  generateServerSeed,
  hashServerSeed,
  verifyCrashPoint,
  generateCoinflipResult,
  evaluateLimboBet,
  getLimboWinChanceBps,
  LIMBO_HOUSE_EDGE,
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

const limbo = evaluateLimboBet({
  serverSeed,
  betId,
  clientSeed,
  targetMultiplier: 2,
  houseEdge: LIMBO_HOUSE_EDGE,
});
assert.ok(limbo.roll >= 0 && limbo.roll < 10000, "limbo roll in range");
const winChance = getLimboWinChanceBps(2, LIMBO_HOUSE_EDGE);
assert.equal(limbo.won, limbo.roll < winChance, "limbo win logic consistent");

console.log("✅ All provably fair tests passed");
console.log(`   Sample crash point: ${crashPoint}x`);
console.log(`   Sample limbo roll: ${limbo.roll} (win chance bps: ${winChance})`);
