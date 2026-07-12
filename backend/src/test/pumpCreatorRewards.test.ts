/**
 * Unit tests for Pump creator-fee lottery helpers.
 * Claim-delta payout must never exceed newly claimed SOL (treasury float safe).
 */
import assert from "node:assert/strict";
import {
  computeClaimOnlyPayout,
  pickWeightedHolder,
  type HolderCandidate,
} from "../services/pumpCreatorRewards.js";

function testClaimDeltaNeverTouchesPriorBalance(): void {
  // Treasury had 10 SOL, claim brought in 0.1 SOL net
  const before = 10_000_000_000;
  const after = 10_100_000_000;
  const split = computeClaimOnlyPayout(before, after, 5000);
  assert.ok(split);
  assert.equal(split!.claimedLamports, 100_000_000);
  assert.equal(split!.winnerLamports, 50_000_000);
  assert.equal(split!.treasuryKeepLamports, 50_000_000);
  assert.ok(split!.winnerLamports <= split!.claimedLamports);
  // Winner share is far below prior treasury (10 SOL)
  assert.ok(split!.winnerLamports < before);
}

function testNoPayoutWhenClaimDidNotIncreaseBalance(): void {
  // Claim tx fee burned more than received (or claim empty)
  assert.equal(computeClaimOnlyPayout(10_000_000_000, 9_999_995_000, 5000), null);
  assert.equal(computeClaimOnlyPayout(5_000_000_000, 5_000_000_000, 5000), null);
}

function testWinnerNeverExceedsClaim(): void {
  const split = computeClaimOnlyPayout(1_000_000_000, 1_003_000_000, 5000);
  assert.ok(split);
  assert.ok(split!.winnerLamports <= split!.claimedLamports);
  assert.equal(split!.winnerLamports + split!.treasuryKeepLamports, split!.claimedLamports);
}

function testWeightedPickPrefersLargerHolder(): void {
  const holders: HolderCandidate[] = [
    { wallet: "small", amount: 1n },
    { wallet: "whale", amount: 1_000_000n },
  ];
  // Entropy that maps into the whale range (ticket >= 1)
  const entropy = Buffer.alloc(8);
  entropy.writeUInt32BE(0, 0);
  entropy.writeUInt32BE(500_000, 4); // within whale slice after small's 1
  // Rebuild: total = 1000001, we need ticket in [1, 1000000]
  const buf = Buffer.from([0, 0, 0, 0, 0, 0x0f, 0x42, 0x40]); // 1_000_000
  const pick = pickWeightedHolder(holders, buf);
  assert.equal(pick?.wallet, "whale");
}

function testWeightedPickEmpty(): void {
  assert.equal(pickWeightedHolder([]), null);
  assert.equal(pickWeightedHolder([{ wallet: "x", amount: 0n }]), null);
}

testClaimDeltaNeverTouchesPriorBalance();
testNoPayoutWhenClaimDidNotIncreaseBalance();
testWinnerNeverExceedsClaim();
testWeightedPickPrefersLargerHolder();
testWeightedPickEmpty();
console.log("pumpCreatorRewards.test.ts: all passed");
