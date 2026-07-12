import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db, getOrCreateUser, updateBalance } from "../db/index.js";
import { config, lamportsToSol, solToLamports } from "../config.js";
import {
  isAnchorEnabled,
  setPausedOnChain,
} from "../services/anchor.js";
import { getIndexerStatus } from "../services/indexer.js";
import { getTournamentLeaderboard } from "../services/tournament.js";
import { isWithdrawalEnabled, sendWithdrawal, getCasinoWalletBalance } from "../services/solana.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { isCasinoPaused, setLegacyCasinoPaused } from "../services/pause.js";
import {
  getTreasurySnapshot,
  listUserBalances,
} from "../services/treasury.js";
import { v4 as uuidv4 } from "uuid";
import { appendOpsLog, listDatabaseBackups } from "../db/backup.js";
import {
  getAdminAnalytics,
  listAdminActivity,
  parseAdminPeriod,
} from "../services/adminAnalytics.js";

export const adminRouter = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

adminRouter.use(adminLimiter, requireAuth, requireAdmin);

adminRouter.get("/dashboard", async (_req, res) => {
  const paused = await isCasinoPaused();
  const analytics1d = getAdminAnalytics("1d");
  const analytics7d = getAdminAnalytics("7d");
  const analyticsAll = getAdminAnalytics("all");

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

  const indexer = getIndexerStatus();
  const tournament = getTournamentLeaderboard();
  const treasury = await getTreasurySnapshot();

  res.json({
    casinoPaused: paused,
    onChainEnabled: isAnchorEnabled(),
    withdrawalsEnabled: isWithdrawalEnabled(),
    totalUsers: analyticsAll.players.total,
    totalBets: analyticsAll.profit.betCount,
    handle24hSol: analytics1d.profit.handleSol,
    grossRevenue24hSol: analytics1d.profit.grossProfitSol,
    netProfit24hSol: analytics1d.profit.netProfitSol,
    netProfit7dSol: analytics7d.profit.netProfitSol,
    netProfitAllTimeSol: analyticsAll.profit.netProfitSol,
    profitAllTime: analyticsAll.profit,
    flow7d: analytics7d.flow,
    games7d: analytics7d.games,
    pendingWithdrawals: pendingWithdrawals.map((w) => ({
      id: w.id,
      walletAddress: w.wallet_address,
      amountSol: lamportsToSol(w.amount_lamports),
      createdAt: w.created_at,
    })),
    tournamentPrizePoolSol: tournament.prizePoolSol,
    indexer,
    adminWallet: config.adminWallet,
    treasury,
  });
});

adminRouter.get("/analytics", (req, res) => {
  const period = parseAdminPeriod(req.query.period);
  res.json(getAdminAnalytics(period));
});

adminRouter.get("/activity", (req, res) => {
  const limit = Number.parseInt(String(req.query.limit ?? "50"), 10);
  const offset = Number.parseInt(String(req.query.offset ?? "0"), 10);
  const typeRaw = req.query.type;
  const type =
    typeRaw === "bet" ||
    typeRaw === "deposit" ||
    typeRaw === "withdrawal" ||
    typeRaw === "all"
      ? typeRaw
      : "all";
  const wallet =
    typeof req.query.wallet === "string" ? req.query.wallet.trim() : undefined;

  res.json(listAdminActivity({ limit, offset, type, wallet }));
});

adminRouter.get("/users", (req, res) => {
  const limit = Number.parseInt(String(req.query.limit ?? "100"), 10);
  const offset = Number.parseInt(String(req.query.offset ?? "0"), 10);
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;

  const result = listUserBalances({ limit, offset, search });
  res.json(result);
});

adminRouter.get("/treasury", async (_req, res) => {
  const treasury = await getTreasurySnapshot();
  res.json(treasury);
});

adminRouter.get("/backups", (_req, res) => {
  res.json({ backups: listDatabaseBackups() });
});

adminRouter.post(
  "/users/:walletAddress/credit",
  (req: AuthenticatedRequest, res) => {
    try {
      const { amountSol, reason } = req.body as {
        amountSol?: number;
        reason?: string;
      };
      const walletParam = req.params.walletAddress;
      const walletAddress =
        typeof walletParam === "string" ? walletParam.trim() : "";

      if (!walletAddress || walletAddress.length < 32) {
        res.status(400).json({ error: "Valid walletAddress required" });
        return;
      }
      if (
        typeof amountSol !== "number" ||
        !Number.isFinite(amountSol) ||
        amountSol <= 0 ||
        amountSol > 1000
      ) {
        res.status(400).json({ error: "amountSol must be between 0 and 1000" });
        return;
      }
      if (!reason?.trim()) {
        res.status(400).json({ error: "reason required for audit trail" });
        return;
      }

      const lamports = solToLamports(amountSol);
      getOrCreateUser(walletAddress);
      const newBalanceLamports = updateBalance(walletAddress, lamports);

      db.prepare(
        `INSERT INTO balance_adjustments (id, wallet_address, delta_lamports, reason, admin_wallet)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        uuidv4(),
        walletAddress,
        lamports,
        reason.trim(),
        req.walletAddress ?? config.adminWallet,
      );

      const msg = `admin credit ${amountSol} SOL → ${walletAddress} (${reason.trim()})`;
      appendOpsLog(msg);

      res.json({
        success: true,
        walletAddress,
        creditedSol: amountSol,
        balanceSol: lamportsToSol(newBalanceLamports),
        reason: reason.trim(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Credit failed",
      });
    }
  },
);

adminRouter.post("/pause", async (req: AuthenticatedRequest, res) => {
  try {
    const { paused } = req.body as { paused?: boolean };
    if (paused === undefined) {
      res.status(400).json({ error: "paused boolean required" });
      return;
    }

    if (isAnchorEnabled()) {
      const signature = await setPausedOnChain(paused);
      res.json({ success: true, paused, signature });
      return;
    }

    setLegacyCasinoPaused(paused);
    res.json({ success: true, paused });
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

adminRouter.post(
  "/withdrawals/:id/process",
  async (req: AuthenticatedRequest, res) => {
    try {
      const withdrawal = db
        .prepare(
          "SELECT id, wallet_address, amount_lamports, status, signature FROM withdrawals WHERE id = ?",
        )
        .get(req.params.id) as
        | {
            id: string;
            wallet_address: string;
            amount_lamports: number;
            status: string;
            signature: string | null;
          }
        | undefined;

      if (!withdrawal || withdrawal.status !== "pending") {
        res.status(404).json({ error: "Pending withdrawal not found" });
        return;
      }

      if (withdrawal.signature) {
        res.status(409).json({
          error: "Withdrawal already sent on-chain — do not re-process",
          signature: withdrawal.signature,
        });
        return;
      }

      if (!isWithdrawalEnabled()) {
        res.status(400).json({ error: "Withdrawal wallet not configured" });
        return;
      }

      const treasuryLamports = await getCasinoWalletBalance();
      if (treasuryLamports < withdrawal.amount_lamports) {
        res.status(503).json({
          error:
            "Treasury wallet has insufficient on-chain SOL for this withdrawal",
        });
        return;
      }

      const { signature } = await sendWithdrawal(
        withdrawal.wallet_address,
        withdrawal.amount_lamports,
      );

      db.prepare(
        "UPDATE withdrawals SET status = 'complete', signature = ? WHERE id = ?",
      ).run(signature, withdrawal.id);

      res.json({
        success: true,
        signature,
        amountSol: lamportsToSol(withdrawal.amount_lamports),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Withdrawal processing failed",
      });
    }
  },
);
