import { Router } from "express";
import { db } from "../db/index.js";
import { config, lamportsToSol } from "../config.js";
import {
  fetchCasinoAccount,
  isAnchorEnabled,
  setPausedOnChain,
} from "../services/anchor.js";
import { getIndexerStatus } from "../services/indexer.js";
import { getTournamentLeaderboard } from "../services/tournament.js";
import { isWithdrawalEnabled } from "../services/solana.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/dashboard", async (_req, res) => {
  const casino = isAnchorEnabled() ? await fetchCasinoAccount() : null;
  const totalUsers = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };
  const totalBets = db
    .prepare("SELECT COUNT(*) as count FROM bets")
    .get() as { count: number };
  const pendingWithdrawals = db
    .prepare(
      `SELECT id, wallet_address, amount_lamports, created_at
       FROM withdrawals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50`,
    )
    .all() as Array<{
      id: string;
      wallet_address: string;
      amount_lamports: number;
      created_at: string;
    }>;

  const last24h = db
    .prepare(
      `SELECT
        COALESCE(SUM(amount_lamports), 0) as handle,
        COALESCE(SUM(amount_lamports - payout_lamports), 0) as gross
       FROM bets WHERE created_at >= datetime('now', '-1 day')`,
    )
    .get() as { handle: number; gross: number };

  const indexer = getIndexerStatus();
  const tournament = getTournamentLeaderboard();

  res.json({
    casinoPaused: casino?.isPaused ?? false,
    onChainEnabled: isAnchorEnabled(),
    withdrawalsEnabled: isWithdrawalEnabled(),
    totalUsers: totalUsers.count,
    totalBets: totalBets.count,
    handle24hSol: lamportsToSol(last24h.handle),
    grossRevenue24hSol: lamportsToSol(last24h.gross),
    pendingWithdrawals: pendingWithdrawals.map((w) => ({
      id: w.id,
      walletAddress: w.wallet_address,
      amountSol: lamportsToSol(w.amount_lamports),
      createdAt: w.created_at,
    })),
    tournamentPrizePoolSol: tournament.prizePoolSol,
    indexer,
    adminWallet: config.adminWallet,
  });
});

adminRouter.post("/pause", async (req: AuthenticatedRequest, res) => {
  try {
    const { paused } = req.body as { paused?: boolean };
    if (paused === undefined) {
      res.status(400).json({ error: "paused boolean required" });
      return;
    }

    if (!isAnchorEnabled()) {
      res.status(400).json({ error: "On-chain mode required to pause casino" });
      return;
    }

    const signature = await setPausedOnChain(paused);
    res.json({ success: true, paused, signature });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update pause state",
    });
  }
});

adminRouter.get("/withdrawals/pending", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, wallet_address, amount_lamports, created_at
       FROM withdrawals WHERE status = 'pending' ORDER BY created_at`,
    )
    .all() as Array<{
      id: string;
      wallet_address: string;
      amount_lamports: number;
      created_at: string;
    }>;

  res.json(
    rows.map((w) => ({
      id: w.id,
      walletAddress: w.wallet_address,
      amountSol: lamportsToSol(w.amount_lamports),
      createdAt: w.created_at,
    })),
  );
});
