/** Standalone assertions for claim-delta safety (no tsx required). */
import assert from "node:assert/strict";

function computeClaimOnlyPayout(before, after, winnerBps) {
  const claimedLamports = after - before;
  if (claimedLamports <= 0) return null;
  const winnerLamports = Math.floor((claimedLamports * winnerBps) / 10_000);
  if (winnerLamports <= 0 || winnerLamports > claimedLamports) return null;
  return {
    claimedLamports,
    winnerLamports,
    treasuryKeepLamports: claimedLamports - winnerLamports,
  };
}

const before = 10_000_000_000;
const after = 10_100_000_000;
const split = computeClaimOnlyPayout(before, after, 5000);
assert.ok(split);
assert.equal(split.claimedLamports, 100_000_000);
assert.equal(split.winnerLamports, 50_000_000);
assert.ok(split.winnerLamports < before); // never pays from prior treasury
assert.equal(computeClaimOnlyPayout(before, before - 1000, 5000), null);
console.log("claim-delta safety: ok");
