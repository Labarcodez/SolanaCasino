import { db } from "../db/index.js";
import { lamportsToSol } from "../config.js";

export type AdminPeriod = "1d" | "7d" | "30d" | "all";

const PERIOD_SQL: Record<AdminPeriod, string> = {
  "1d": "datetime('now', '-1 day')",
  "7d": "datetime('now', '-7 days')",
  "30d": "datetime('now', '-30 days')",
  all: "datetime('1970-01-01')",
};

export function parseAdminPeriod(raw: unknown): AdminPeriod {
  if (raw === "1d" || raw === "7d" || raw === "30d" || raw === "all") {
    return raw;
  }
  return "7d";
}

function periodFilter(column: string, period: AdminPeriod): string {
  return `${column} >= ${PERIOD_SQL[period]}`;
}

export interface AdminGameStats {
  game: string;
  betCount: number;
  handleSol: number;
  grossProfitSol: number;
  winRatePercent: number;
}

export interface AdminPlayerLeader {
  walletAddress: string;
  displayName: string | null;
  handleSol: number;
  netPnlSol: number;
  betCount: number;
}

export interface AdminAnalytics {
  period: AdminPeriod;
  profit: {
    grossProfitSol: number;
    rakebackPaidSol: number;
    affiliatePaidSol: number;
    jackpotPaidSol: number;
    tournamentPaidSol: number;
    netProfitSol: number;
    handleSol: number;
    betCount: number;
    effectiveHoldPercent: number;
  };
  flow: {
    depositsSol: number;
    depositCount: number;
    withdrawalsSol: number;
    withdrawalCount: number;
    netDepositSol: number;
  };
  games: AdminGameStats[];
  players: {
    activeInPeriod: number;
    newInPeriod: number;
    total: number;
  };
  topWinners: AdminPlayerLeader[];
  topLosers: AdminPlayerLeader[];
}

export interface AdminActivityItem {
  id: string;
  type: "bet" | "deposit" | "withdrawal";
  walletAddress: string;
  displayName: string | null;
  amountSol: number;
  payoutSol?: number;
  detail: string;
  createdAt: string;
}

function betStats(period: AdminPeriod) {
  const where = periodFilter("created_at", period);
  return db
    .prepare(
      `SELECT
        COALESCE(COUNT(*), 0) AS bet_count,
        COALESCE(SUM(amount_lamports), 0) AS handle,
        COALESCE(SUM(amount_lamports - payout_lamports), 0) AS gross,
        COALESCE(SUM(CASE WHEN payout_lamports > amount_lamports THEN 1 ELSE 0 END), 0) AS wins
       FROM bets WHERE ${where}`,
    )
    .get() as { bet_count: number; handle: number; gross: number; wins: number };
}

function sumInPeriod(
  table: string,
  amountColumn: string,
  period: AdminPeriod,
): { total: number; count: number } {
  const where = periodFilter("created_at", period);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(${amountColumn}), 0) AS total, COALESCE(COUNT(*), 0) AS count
       FROM ${table} WHERE ${where}`,
    )
    .get() as { total: number; count: number };
  return row;
}

function gameBreakdown(period: AdminPeriod): AdminGameStats[] {
  const where = periodFilter("created_at", period);
  const rows = db
    .prepare(
      `SELECT
        game,
        COUNT(*) AS bet_count,
        COALESCE(SUM(amount_lamports), 0) AS handle,
        COALESCE(SUM(amount_lamports - payout_lamports), 0) AS gross,
        COALESCE(SUM(CASE WHEN payout_lamports > amount_lamports THEN 1 ELSE 0 END), 0) AS wins
       FROM bets WHERE ${where}
       GROUP BY game
       ORDER BY handle DESC`,
    )
    .all() as Array<{
      game: string;
      bet_count: number;
      handle: number;
      gross: number;
      wins: number;
    }>;

  return rows.map((r) => ({
    game: r.game,
    betCount: r.bet_count,
    handleSol: lamportsToSol(r.handle),
    grossProfitSol: lamportsToSol(r.gross),
    winRatePercent:
      r.bet_count > 0 ? Math.round((r.wins / r.bet_count) * 1000) / 10 : 0,
  }));
}

function playerLeaders(
  period: AdminPeriod,
  direction: "winners" | "losers",
  limit = 8,
): AdminPlayerLeader[] {
  const where = periodFilter("b.created_at", period);
  const order = direction === "winners" ? "net DESC" : "net ASC";
  const rows = db
    .prepare(
      `SELECT
        b.wallet_address,
        u.display_name,
        COALESCE(SUM(b.amount_lamports), 0) AS handle,
        COALESCE(SUM(b.payout_lamports - b.amount_lamports), 0) AS net,
        COUNT(*) AS bet_count
       FROM bets b
       LEFT JOIN users u ON u.wallet_address = b.wallet_address
       WHERE ${where}
       GROUP BY b.wallet_address
       HAVING bet_count > 0
       ORDER BY ${order}
       LIMIT ?`,
    )
    .all(limit) as Array<{
      wallet_address: string;
      display_name: string | null;
      handle: number;
      net: number;
      bet_count: number;
    }>;

  return rows.map((r) => ({
    walletAddress: r.wallet_address,
    displayName: r.display_name,
    handleSol: lamportsToSol(r.handle),
    netPnlSol: lamportsToSol(r.net),
    betCount: r.bet_count,
  }));
}

export function getAdminAnalytics(period: AdminPeriod): AdminAnalytics {
  const bets = betStats(period);
  const deposits = sumInPeriod("deposits", "amount_lamports", period);
  const withdrawals = sumInPeriod(
    "withdrawals",
    "amount_lamports",
    period,
  );
  const rakeback = sumInPeriod("rakeback_claims", "amount_lamports", period);
  const affiliate = sumInPeriod("affiliate_claims", "amount_lamports", period);
  const jackpot = sumInPeriod("jackpot_payouts", "amount_lamports", period);
  const tournament = sumInPeriod(
    "tournament_payouts",
    "amount_lamports",
    period,
  );

  const grossProfitSol = lamportsToSol(bets.gross);
  const rakebackPaidSol = lamportsToSol(rakeback.total);
  const affiliatePaidSol = lamportsToSol(affiliate.total);
  const jackpotPaidSol = lamportsToSol(jackpot.total);
  const tournamentPaidSol = lamportsToSol(tournament.total);
  const handleSol = lamportsToSol(bets.handle);

  const activeRow = db
    .prepare(
      `SELECT COUNT(DISTINCT wallet_address) AS count FROM bets
       WHERE ${periodFilter("created_at", period)}`,
    )
    .get() as { count: number };

  const newRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM users
       WHERE ${periodFilter("created_at", period)}`,
    )
    .get() as { count: number };

  const totalRow = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };

  return {
    period,
    profit: {
      grossProfitSol,
      rakebackPaidSol,
      affiliatePaidSol,
      jackpotPaidSol,
      tournamentPaidSol,
      netProfitSol:
        grossProfitSol -
        rakebackPaidSol -
        affiliatePaidSol -
        jackpotPaidSol -
        tournamentPaidSol,
      handleSol,
      betCount: bets.bet_count,
      effectiveHoldPercent:
        bets.handle > 0
          ? Math.round((bets.gross / bets.handle) * 10000) / 100
          : 0,
    },
    flow: {
      depositsSol: lamportsToSol(deposits.total),
      depositCount: deposits.count,
      withdrawalsSol: lamportsToSol(withdrawals.total),
      withdrawalCount: withdrawals.count,
      netDepositSol: lamportsToSol(deposits.total - withdrawals.total),
    },
    games: gameBreakdown(period),
    players: {
      activeInPeriod: activeRow.count,
      newInPeriod: newRow.count,
      total: totalRow.count,
    },
    topWinners: playerLeaders(period, "winners"),
    topLosers: playerLeaders(period, "losers"),
  };
}

export function listAdminActivity(params: {
  limit?: number;
  offset?: number;
  type?: "all" | "bet" | "deposit" | "withdrawal";
  wallet?: string;
}): {
  items: AdminActivityItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
} {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const typeFilter = params.type ?? "all";
  const walletFilter = params.wallet?.trim();
  const overFetch = Math.min(offset + limit, 500);

  const bets =
    typeFilter === "all" || typeFilter === "bet"
      ? (walletFilter
          ? (db
              .prepare(
                `SELECT b.id, b.wallet_address, u.display_name, b.game, b.amount_lamports,
                        b.payout_lamports, b.multiplier, b.result, b.created_at
                 FROM bets b
                 LEFT JOIN users u ON u.wallet_address = b.wallet_address
                 WHERE b.wallet_address = ?
                 ORDER BY b.created_at DESC LIMIT ?`,
              )
              .all(walletFilter, overFetch) as Array<{
              id: string;
              wallet_address: string;
              display_name: string | null;
              game: string;
              amount_lamports: number;
              payout_lamports: number;
              multiplier: number | null;
              result: string | null;
              created_at: string;
            }>)
          : (db
              .prepare(
                `SELECT b.id, b.wallet_address, u.display_name, b.game, b.amount_lamports,
                        b.payout_lamports, b.multiplier, b.result, b.created_at
                 FROM bets b
                 LEFT JOIN users u ON u.wallet_address = b.wallet_address
                 ORDER BY b.created_at DESC LIMIT ?`,
              )
              .all(overFetch) as Array<{
              id: string;
              wallet_address: string;
              display_name: string | null;
              game: string;
              amount_lamports: number;
              payout_lamports: number;
              multiplier: number | null;
              result: string | null;
              created_at: string;
            }>))
      : [];

  const deposits =
    typeFilter === "all" || typeFilter === "deposit"
      ? (walletFilter
          ? (db
              .prepare(
                `SELECT d.id, d.wallet_address, u.display_name, d.amount_lamports, d.status, d.created_at
                 FROM deposits d
                 LEFT JOIN users u ON u.wallet_address = d.wallet_address
                 WHERE d.wallet_address = ?
                 ORDER BY d.created_at DESC LIMIT ?`,
              )
              .all(walletFilter, overFetch) as Array<{
              id: string;
              wallet_address: string;
              display_name: string | null;
              amount_lamports: number;
              status: string;
              created_at: string;
            }>)
          : (db
              .prepare(
                `SELECT d.id, d.wallet_address, u.display_name, d.amount_lamports, d.status, d.created_at
                 FROM deposits d
                 LEFT JOIN users u ON u.wallet_address = d.wallet_address
                 ORDER BY d.created_at DESC LIMIT ?`,
              )
              .all(overFetch) as Array<{
              id: string;
              wallet_address: string;
              display_name: string | null;
              amount_lamports: number;
              status: string;
              created_at: string;
            }>))
      : [];

  const withdrawals =
    typeFilter === "all" || typeFilter === "withdrawal"
      ? (walletFilter
          ? (db
              .prepare(
                `SELECT w.id, w.wallet_address, u.display_name, w.amount_lamports, w.status, w.created_at
                 FROM withdrawals w
                 LEFT JOIN users u ON u.wallet_address = w.wallet_address
                 WHERE w.wallet_address = ?
                 ORDER BY w.created_at DESC LIMIT ?`,
              )
              .all(walletFilter, overFetch) as Array<{
              id: string;
              wallet_address: string;
              display_name: string | null;
              amount_lamports: number;
              status: string;
              created_at: string;
            }>)
          : (db
              .prepare(
                `SELECT w.id, w.wallet_address, u.display_name, w.amount_lamports, w.status, w.created_at
                 FROM withdrawals w
                 LEFT JOIN users u ON u.wallet_address = w.wallet_address
                 ORDER BY w.created_at DESC LIMIT ?`,
              )
              .all(overFetch) as Array<{
              id: string;
              wallet_address: string;
              display_name: string | null;
              amount_lamports: number;
              status: string;
              created_at: string;
            }>))
      : [];

  const countBet =
    typeFilter === "all" || typeFilter === "bet"
      ? walletFilter
        ? (
            db
              .prepare("SELECT COUNT(*) AS c FROM bets WHERE wallet_address = ?")
              .get(walletFilter) as { c: number }
          ).c
        : (db.prepare("SELECT COUNT(*) AS c FROM bets").get() as { c: number }).c
      : 0;
  const countDeposit =
    typeFilter === "all" || typeFilter === "deposit"
      ? walletFilter
        ? (
            db
              .prepare(
                "SELECT COUNT(*) AS c FROM deposits WHERE wallet_address = ?",
              )
              .get(walletFilter) as { c: number }
          ).c
        : (db.prepare("SELECT COUNT(*) AS c FROM deposits").get() as { c: number })
            .c
      : 0;
  const countWithdrawal =
    typeFilter === "all" || typeFilter === "withdrawal"
      ? walletFilter
        ? (
            db
              .prepare(
                "SELECT COUNT(*) AS c FROM withdrawals WHERE wallet_address = ?",
              )
              .get(walletFilter) as { c: number }
          ).c
        : (
            db.prepare("SELECT COUNT(*) AS c FROM withdrawals").get() as {
              c: number;
            }
          ).c
      : 0;
  const total = countBet + countDeposit + countWithdrawal;

  const items: AdminActivityItem[] = [];

  for (const b of bets) {
    const mult =
      b.multiplier != null ? ` @ ${b.multiplier.toFixed(2)}x` : "";
    const result = b.result ? ` · ${b.result}` : "";
    items.push({
      id: b.id,
      type: "bet",
      walletAddress: b.wallet_address,
      displayName: b.display_name,
      amountSol: lamportsToSol(b.amount_lamports),
      payoutSol: lamportsToSol(b.payout_lamports),
      detail: `${b.game}${mult}${result}`,
      createdAt: b.created_at,
    });
  }

  for (const d of deposits) {
    items.push({
      id: d.id,
      type: "deposit",
      walletAddress: d.wallet_address,
      displayName: d.display_name,
      amountSol: lamportsToSol(d.amount_lamports),
      detail: d.status,
      createdAt: d.created_at,
    });
  }

  for (const w of withdrawals) {
    items.push({
      id: w.id,
      type: "withdrawal",
      walletAddress: w.wallet_address,
      displayName: w.display_name,
      amountSol: lamportsToSol(w.amount_lamports),
      detail: w.status,
      createdAt: w.created_at,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const page = items.slice(offset, offset + limit);

  return {
    items: page,
    total,
    limit,
    offset,
    hasMore: offset + page.length < total,
  };
}
