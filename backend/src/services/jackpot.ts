import { v4 as uuidv4 } from "uuid";
import { db, updateBalance } from "../db/index.js";
import { lamportsToSol } from "../config.js";
import { creditPlayerOnChain, isAnchorEnabled } from "./anchor.js";
import type { CrashBet } from "./crash.js";

export const JACKPOT_CONTRIBUTION_BPS = 50;
export const MIN_CRASH_FOR_JACKPOT = 2.0;
export const MIN_POOL_LAMPORTS = 10_000_000;

const POOL_META_KEY = "jackpot_pool_lamports";

export interface JackpotAward {
  roundId: string;
  walletAddress: string;
  amountLamports: number;
  cashoutMultiplier: number;
  crashPoint: number;
}

export interface JackpotPayoutView {
  roundId: string;
  walletAddress: string;
  amountSol: number;
  cashoutMultiplier: number;
  crashPoint: number;
  createdAt: string;
}

export interface JackpotState {
  poolLamports: number;
  poolSol: number;
  contributionBps: number;
  minCrashMultiplier: number;
  lastPayout: JackpotPayoutView | null;
}

function readPoolLamports(): number {
  const row = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(POOL_META_KEY) as { value: string } | undefined;
  return row ? Number.parseInt(row.value, 10) || 0 : 0;
}

function writePoolLamports(amount: number): void {
  db.prepare(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
  ).run(POOL_META_KEY, String(Math.max(0, amount)));
}

export function recordJackpotContribution(
  betId: string,
  roundId: string,
  walletAddress: string,
  amountLamports: number,
): number {
  const contribution = Math.floor(
    (amountLamports * JACKPOT_CONTRIBUTION_BPS) / 10_000,
  );
  if (contribution <= 0) return 0;

  db.prepare(
    `INSERT INTO jackpot_contributions
     (id, round_id, bet_id, wallet_address, amount_lamports)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(uuidv4(), roundId, betId, walletAddress, contribution);

  writePoolLamports(readPoolLamports() + contribution);
  return contribution;
}

export async function tryAwardJackpot(
  roundId: string,
  crashPoint: number,
  bets: CrashBet[],
): Promise<JackpotAward | null> {
  if (crashPoint < MIN_CRASH_FOR_JACKPOT) return null;

  const pool = readPoolLamports();
  if (pool < MIN_POOL_LAMPORTS) return null;

  const cashedOut = bets.filter(
    (b) => b.cashedOut && b.cashoutMultiplier !== undefined,
  );
  if (cashedOut.length === 0) return null;

  const winner = cashedOut.reduce((best, bet) =>
    (bet.cashoutMultiplier ?? 0) > (best.cashoutMultiplier ?? 0) ? bet : best,
  );

  if (isAnchorEnabled()) {
    await creditPlayerOnChain(winner.walletAddress, pool);
  } else {
    updateBalance(winner.walletAddress, pool);
  }

  db.prepare(
    `INSERT INTO jackpot_payouts
     (id, round_id, wallet_address, amount_lamports, cashout_multiplier, crash_point)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    uuidv4(),
    roundId,
    winner.walletAddress,
    pool,
    winner.cashoutMultiplier!,
    crashPoint,
  );

  writePoolLamports(0);

  return {
    roundId,
    walletAddress: winner.walletAddress,
    amountLamports: pool,
    cashoutMultiplier: winner.cashoutMultiplier!,
    crashPoint,
  };
}

export function getJackpotState(): JackpotState {
  const poolLamports = readPoolLamports();
  const last = db
    .prepare(
      `SELECT round_id, wallet_address, amount_lamports, cashout_multiplier,
              crash_point, created_at
       FROM jackpot_payouts
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as
    | {
        round_id: string;
        wallet_address: string;
        amount_lamports: number;
        cashout_multiplier: number;
        crash_point: number;
        created_at: string;
      }
    | undefined;

  return {
    poolLamports,
    poolSol: lamportsToSol(poolLamports),
    contributionBps: JACKPOT_CONTRIBUTION_BPS,
    minCrashMultiplier: MIN_CRASH_FOR_JACKPOT,
    lastPayout: last
      ? {
          roundId: last.round_id,
          walletAddress:
            last.wallet_address.slice(0, 4) +
            "..." +
            last.wallet_address.slice(-4),
          amountSol: lamportsToSol(last.amount_lamports),
          cashoutMultiplier: last.cashout_multiplier,
          crashPoint: last.crash_point,
          createdAt: last.created_at,
        }
      : null,
  };
}
