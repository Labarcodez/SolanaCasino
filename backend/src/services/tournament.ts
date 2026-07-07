import { db } from "../db/index.js";
import { lamportsToSol } from "../config.js";
import { getDisplayName } from "./profile.js";

function getWeekBounds(): { weekId: string; weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const weekId = monday.toISOString().slice(0, 10);
  return {
    weekId,
    weekStart: monday.toISOString(),
    weekEnd: sunday.toISOString(),
  };
}

export function ensureCurrentTournamentWeek(): string {
  const { weekId, weekStart, weekEnd } = getWeekBounds();
  const existing = db
    .prepare("SELECT id FROM tournament_weeks WHERE id = ?")
    .get(weekId);

  if (!existing) {
    db.prepare(
      `INSERT INTO tournament_weeks (id, week_start, week_end, prize_pool_lamports)
       VALUES (?, ?, ?, 0)`,
    ).run(weekId, weekStart, weekEnd);
  }

  return weekId;
}

export function recordTournamentWager(
  walletAddress: string,
  amountLamports: number,
): void {
  const weekId = ensureCurrentTournamentWeek();
  db.prepare(
    `INSERT INTO tournament_entries (week_id, wallet_address, wagered_lamports)
     VALUES (?, ?, ?)
     ON CONFLICT(week_id, wallet_address)
     DO UPDATE SET wagered_lamports = wagered_lamports + excluded.wagered_lamports`,
  ).run(weekId, walletAddress, amountLamports);

  const prizeContribution = Math.floor(amountLamports * 0.01);
  db.prepare(
    `UPDATE tournament_weeks SET prize_pool_lamports = prize_pool_lamports + ?
     WHERE id = ?`,
  ).run(prizeContribution, weekId);
}

export function getTournamentLeaderboard(): {
  weekId: string;
  weekEnd: string;
  prizePoolSol: number;
  entries: Array<{
    rank: number;
    displayName: string;
    walletAddress: string;
    wageredSol: number;
    estimatedPrizeSol: number;
  }>;
} {
  const weekId = ensureCurrentTournamentWeek();
  const week = db
    .prepare("SELECT week_end, prize_pool_lamports FROM tournament_weeks WHERE id = ?")
    .get(weekId) as { week_end: string; prize_pool_lamports: number };

  const entries = db
    .prepare(
      `SELECT wallet_address, wagered_lamports
       FROM tournament_entries
       WHERE week_id = ?
       ORDER BY wagered_lamports DESC
       LIMIT 20`,
    )
    .all(weekId) as Array<{
      wallet_address: string;
      wagered_lamports: number;
    }>;

  const prizeShares = [0.4, 0.25, 0.15, 0.1, 0.05, 0.025, 0.015, 0.01];
  const pool = week.prize_pool_lamports;

  return {
    weekId,
    weekEnd: week.week_end,
    prizePoolSol: lamportsToSol(pool),
    entries: entries.map((e, i) => ({
      rank: i + 1,
      displayName: getDisplayName(e.wallet_address),
      walletAddress:
        e.wallet_address.slice(0, 4) + "..." + e.wallet_address.slice(-4),
      wageredSol: lamportsToSol(e.wagered_lamports),
      estimatedPrizeSol: lamportsToSol(
        Math.floor(pool * (prizeShares[i] ?? 0)),
      ),
    })),
  };
}
