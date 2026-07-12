import { config } from "../config.js";
import { isCasinoPaused } from "./pause.js";
import { getTreasurySnapshot } from "./treasury.js";

const SOLVENT_CACHE_MS = 30_000;

let solventCache: { solvent: boolean; at: number } | null = null;

export function invalidateTreasurySolventCache(): void {
  solventCache = null;
}

export async function isTreasurySolventCached(): Promise<boolean> {
  const now = Date.now();
  if (solventCache && now - solventCache.at < SOLVENT_CACHE_MS) {
    return solventCache.solvent;
  }
  try {
    const snap = await getTreasurySnapshot();
    solventCache = { solvent: snap.solvent, at: now };
    return snap.solvent;
  } catch (err) {
    console.warn(
      "Treasury solvency check failed — allowing bets:",
      err instanceof Error ? err.message : err,
    );
    // Fail open on RPC errors so a brief RPC outage does not freeze the house.
    return true;
  }
}

export type BettingBlock = {
  blocked: boolean;
  reason?: string;
  code?: "CASINO_PAUSED" | "TREASURY_INSOLVENT";
};

/**
 * Shared gate for crash / limbo / coinflip entries.
 * Manual pause always blocks; insolvency blocks when configured.
 */
export async function getBettingBlock(): Promise<BettingBlock> {
  if (await isCasinoPaused()) {
    return {
      blocked: true,
      reason: "Casino is paused",
      code: "CASINO_PAUSED",
    };
  }

  if (config.blockBetsWhenInsolvent) {
    const solvent = await isTreasurySolventCached();
    if (!solvent) {
      return {
        blocked: true,
        reason:
          "Betting temporarily paused — treasury is rebalancing. Try again shortly.",
        code: "TREASURY_INSOLVENT",
      };
    }
  }

  return { blocked: false };
}
