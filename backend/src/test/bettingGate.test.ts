/**
 * Unit checks for betting gate reason codes (no DB/RPC).
 */
import assert from "node:assert/strict";

type BettingBlock = {
  blocked: boolean;
  reason?: string;
  code?: "CASINO_PAUSED" | "TREASURY_INSOLVENT";
};

function resolveBettingBlock(opts: {
  paused: boolean;
  blockWhenInsolvent: boolean;
  solvent: boolean;
}): BettingBlock {
  if (opts.paused) {
    return {
      blocked: true,
      reason: "Casino is paused",
      code: "CASINO_PAUSED",
    };
  }
  if (opts.blockWhenInsolvent && !opts.solvent) {
    return {
      blocked: true,
      reason:
        "Betting temporarily paused — treasury is rebalancing. Try again shortly.",
      code: "TREASURY_INSOLVENT",
    };
  }
  return { blocked: false };
}

assert.equal(
  resolveBettingBlock({ paused: true, blockWhenInsolvent: true, solvent: false })
    .code,
  "CASINO_PAUSED",
);
assert.equal(
  resolveBettingBlock({
    paused: false,
    blockWhenInsolvent: true,
    solvent: false,
  }).code,
  "TREASURY_INSOLVENT",
);
assert.equal(
  resolveBettingBlock({
    paused: false,
    blockWhenInsolvent: false,
    solvent: false,
  }).blocked,
  false,
);
assert.equal(
  resolveBettingBlock({ paused: false, blockWhenInsolvent: true, solvent: true })
    .blocked,
  false,
);

console.log("bettingGate.test.ts: ok");
