import { db } from "../db/index.js";
import { config, lamportsToSol } from "../config.js";
import { getCasinoWalletBalance } from "./solana.js";

export interface TreasurySnapshot {
  casinoWallet: string;
  treasuryBalanceSol: number;
  totalUserBalancesSol: number;
  pendingWithdrawalsSol: number;
  totalLiabilitiesSol: number;
  treasurySurplusSol: number;
  solvent: boolean;
}

export interface AdminUserBalanceRow {
  walletAddress: string;
  displayName: string | null;
  balanceSol: number;
  totalWageredSol: number;
  totalWonSol: number;
  netPnlSol: number;
  createdAt: string;
  updatedAt: string;
}

export async function getTreasurySnapshot(): Promise<TreasurySnapshot> {
  const treasuryLamports = await getCasinoWalletBalance();

  const userRow = db
    .prepare("SELECT COALESCE(SUM(balance_lamports), 0) AS total FROM users")
    .get() as { total: number };

  const pendingRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM withdrawals
       WHERE status = 'pending'`,
    )
    .get() as { total: number };

  const totalLiabilitiesLamports = userRow.total + pendingRow.total;

  const surplusLamports = treasuryLamports - totalLiabilitiesLamports;

  return {
    casinoWallet: config.casinoWalletAddress,
    treasuryBalanceSol: lamportsToSol(treasuryLamports),
    totalUserBalancesSol: lamportsToSol(userRow.total),
    pendingWithdrawalsSol: lamportsToSol(pendingRow.total),
    totalLiabilitiesSol: lamportsToSol(totalLiabilitiesLamports),
    treasurySurplusSol: lamportsToSol(surplusLamports),
    solvent: surplusLamports >= 0,
  };
}

export function listUserBalances(params: {
  limit?: number;
  offset?: number;
  search?: string;
}): {
  users: AdminUserBalanceRow[];
  total: number;
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);
  const search = params.search?.trim();

  const whereClause = search
    ? "WHERE wallet_address LIKE ? OR display_name LIKE ?"
    : "";
  const searchArg = search ? `%${search}%` : "";

  const countQuery = search
    ? db.prepare(`SELECT COUNT(*) AS count FROM users ${whereClause}`)
    : db.prepare("SELECT COUNT(*) AS count FROM users");

  const total = (
    search
      ? countQuery.get(searchArg, searchArg)
      : countQuery.get()
  ) as { count: number };

  const rowsQuery = search
    ? db.prepare(
        `SELECT wallet_address, display_name, balance_lamports, total_wagered_lamports,
                total_won_lamports, created_at, updated_at
         FROM users ${whereClause}
         ORDER BY balance_lamports DESC, updated_at DESC
         LIMIT ? OFFSET ?`,
      )
    : db.prepare(
        `SELECT wallet_address, display_name, balance_lamports, total_wagered_lamports,
                total_won_lamports, created_at, updated_at
         FROM users
         ORDER BY balance_lamports DESC, updated_at DESC
         LIMIT ? OFFSET ?`,
      );

  const rows = (
    search
      ? rowsQuery.all(searchArg, searchArg, limit, offset)
      : rowsQuery.all(limit, offset)
  ) as Array<{
    wallet_address: string;
    display_name: string | null;
    balance_lamports: number;
    total_wagered_lamports: number;
    total_won_lamports: number;
    created_at: string;
    updated_at: string;
  }>;

  return {
    users: rows.map((r) => ({
      walletAddress: r.wallet_address,
      displayName: r.display_name,
      balanceSol: lamportsToSol(r.balance_lamports),
      totalWageredSol: lamportsToSol(r.total_wagered_lamports),
      totalWonSol: lamportsToSol(r.total_won_lamports),
      netPnlSol: lamportsToSol(
        r.total_won_lamports - r.total_wagered_lamports,
      ),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total: total.count,
    limit,
    offset,
  };
}
