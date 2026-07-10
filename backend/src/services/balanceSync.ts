import { db, getOrCreateUser, updateBalance } from "../db/index.js";
import { waitForSignatureConfirmation } from "./solana.js";
import { Connection } from "@solana/web3.js";
import { config } from "../config.js";

type PendingWithdrawal = {
  id: string;
  signature: string;
  amount_lamports: number;
};

/**
 * Mark pending withdrawals as complete once their on-chain signature confirms.
 */
export async function finalizePendingWithdrawals(walletAddress: string): Promise<void> {
  const rows = db
    .prepare(
      `SELECT id, signature, amount_lamports FROM withdrawals
       WHERE wallet_address = ? AND status = 'pending' AND signature IS NOT NULL`,
    )
    .all(walletAddress) as PendingWithdrawal[];

  if (rows.length === 0) return;

  const conn = new Connection(config.solanaRpcUrl, "confirmed");

  for (const row of rows) {
    const result = await waitForSignatureConfirmation(conn, row.signature, 8_000);
    if (result === "confirmed") {
      db.prepare("UPDATE withdrawals SET status = 'complete' WHERE id = ?").run(row.id);
    }
  }
}

/**
 * Fix custodial balance when a payout succeeded but a rollback over-credited the user.
 * Uses deposits, withdrawals, and wager/win totals — same sources that drive balance updates.
 */
export function syncBalanceFromLedger(walletAddress: string): number {
  const user = getOrCreateUser(walletAddress);

  const depositRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM deposits WHERE wallet_address = ?",
    )
    .get(walletAddress) as { total: number };

  const withdrawRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM withdrawals
       WHERE wallet_address = ? AND status IN ('complete', 'pending')`,
    )
    .get(walletAddress) as { total: number };

  const rakebackRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM rakeback_claims WHERE wallet_address = ?",
    )
    .get(walletAddress) as { total: number };

  const affiliateRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM affiliate_claims WHERE wallet_address = ?",
    )
    .get(walletAddress) as { total: number };

  const tournamentRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM tournament_payouts WHERE wallet_address = ?",
    )
    .get(walletAddress) as { total: number };

  const expected =
    depositRow.total -
    withdrawRow.total +
    user.total_won_lamports -
    user.total_wagered_lamports +
    rakebackRow.total +
    affiliateRow.total +
    tournamentRow.total;

  if (user.balance_lamports > expected) {
    db.prepare(
      "UPDATE users SET balance_lamports = ?, updated_at = datetime('now') WHERE wallet_address = ?",
    ).run(expected, walletAddress);
    return expected;
  }

  return user.balance_lamports;
}

export function cancelPendingWithdrawal(withdrawalId: string, walletAddress: string): void {
  const row = db
    .prepare(
      "SELECT id, amount_lamports, status FROM withdrawals WHERE id = ? AND wallet_address = ?",
    )
    .get(withdrawalId, walletAddress) as
    | { id: string; amount_lamports: number; status: string }
    | undefined;

  if (!row || row.status !== "pending") return;

  db.prepare("UPDATE withdrawals SET status = 'failed' WHERE id = ?").run(withdrawalId);
  updateBalance(walletAddress, row.amount_lamports);
}
