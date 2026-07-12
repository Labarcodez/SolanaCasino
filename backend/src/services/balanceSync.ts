import { db, getOrCreateUser, updateBalance } from "../db/index.js";
import { waitForSignatureConfirmation } from "./solana.js";
import { Connection } from "@solana/web3.js";
import { config } from "../config.js";

type PendingWithdrawal = {
  id: string;
  signature: string;
  amount_lamports: number;
};

type PendingWithdrawalRow = PendingWithdrawal & { wallet_address: string };

async function settlePendingRow(
  conn: Connection,
  row: PendingWithdrawalRow,
): Promise<"complete" | "failed" | "pending"> {
  const result = await waitForSignatureConfirmation(conn, row.signature, 8_000);
  if (result === "confirmed") {
    db.prepare("UPDATE withdrawals SET status = 'complete' WHERE id = ?").run(
      row.id,
    );
    return "complete";
  }
  if (result === "failed") {
    cancelPendingWithdrawal(row.id, row.wallet_address);
    return "failed";
  }
  return "pending";
}

/**
 * Mark pending withdrawals as complete once their on-chain signature confirms.
 */
export async function finalizePendingWithdrawals(
  walletAddress: string,
): Promise<void> {
  const rows = db
    .prepare(
      `SELECT id, signature, amount_lamports, wallet_address FROM withdrawals
       WHERE wallet_address = ? AND status = 'pending' AND signature IS NOT NULL`,
    )
    .all(walletAddress) as PendingWithdrawalRow[];

  if (rows.length === 0) return;

  const conn = new Connection(config.solanaRpcUrl, "confirmed");

  for (const row of rows) {
    await settlePendingRow(conn, row);
  }
}

/**
 * Background sweeper: confirm (or refund) all pending withdrawals with signatures.
 */
export async function finalizeAllPendingWithdrawals(): Promise<{
  checked: number;
  completed: number;
  failed: number;
}> {
  const rows = db
    .prepare(
      `SELECT id, signature, amount_lamports, wallet_address FROM withdrawals
       WHERE status = 'pending' AND signature IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 50`,
    )
    .all() as PendingWithdrawalRow[];

  if (rows.length === 0) {
    return { checked: 0, completed: 0, failed: 0 };
  }

  const conn = new Connection(config.solanaRpcUrl, "confirmed");
  let completed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const outcome = await settlePendingRow(conn, row);
      if (outcome === "complete") completed += 1;
      if (outcome === "failed") failed += 1;
    } catch (err) {
      console.warn(
        `Withdraw finalize ${row.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { checked: rows.length, completed, failed };
}

let withdrawFinalizeTimer: ReturnType<typeof setInterval> | null = null;

export function startWithdrawalFinalizer(): void {
  if (withdrawFinalizeTimer) return;

  const tick = () => {
    void finalizeAllPendingWithdrawals()
      .then((r) => {
        if (r.completed > 0 || r.failed > 0) {
          console.log(
            `Withdraw finalizer: checked=${r.checked} completed=${r.completed} failed=${r.failed}`,
          );
        }
      })
      .catch((err) => {
        console.warn(
          "Withdraw finalizer error:",
          err instanceof Error ? err.message : err,
        );
      });
  };

  tick();
  withdrawFinalizeTimer = setInterval(tick, config.withdrawFinalizeIntervalMs);
  if (typeof withdrawFinalizeTimer.unref === "function") {
    withdrawFinalizeTimer.unref();
  }
}

export function stopWithdrawalFinalizer(): void {
  if (withdrawFinalizeTimer) {
    clearInterval(withdrawFinalizeTimer);
    withdrawFinalizeTimer = null;
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

  const jackpotRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM jackpot_payouts WHERE wallet_address = ?",
    )
    .get(walletAddress) as { total: number };

  const expected =
    depositRow.total -
    withdrawRow.total +
    user.total_won_lamports -
    user.total_wagered_lamports +
    rakebackRow.total +
    affiliateRow.total +
    tournamentRow.total +
    jackpotRow.total;

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
