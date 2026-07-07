import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  getOrCreateUser,
  updateBalance,
} from "../db/index.js";
import { config, lamportsToSol, solToLamports } from "../config.js";
import {
  getCasinoWalletBalance,
  getWalletBalance,
  isWithdrawalEnabled,
  sendWithdrawal,
  verifyDeposit,
} from "../services/solana.js";
import { placeCoinflipBet } from "../services/coinflip.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.get("/config", (_req, res) => {
  res.json({
    casinoWallet: config.casinoWalletAddress,
    minBetSol: config.minBetSol,
    maxBetSol: config.maxBetSol,
    minWithdrawSol: config.minWithdrawSol,
    houseEdge: config.houseEdge,
    withdrawalsEnabled: isWithdrawalEnabled(),
  });
});

apiRouter.get("/user/:walletAddress", async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const user = getOrCreateUser(walletAddress);
    const onChainBalance = await getWalletBalance(walletAddress);

    res.json({
      walletAddress: user.wallet_address,
      balanceSol: lamportsToSol(user.balance_lamports),
      balanceLamports: user.balance_lamports,
      onChainBalanceSol: lamportsToSol(onChainBalance),
      totalWageredSol: lamportsToSol(user.total_wagered_lamports),
      totalWonSol: lamportsToSol(user.total_won_lamports),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch user",
    });
  }
});

apiRouter.post("/deposit/verify", async (req, res) => {
  try {
    const { signature, walletAddress } = req.body as {
      signature?: string;
      walletAddress?: string;
    };

    if (!signature || !walletAddress) {
      res.status(400).json({ error: "signature and walletAddress required" });
      return;
    }

    const existing = db
      .prepare("SELECT id FROM deposits WHERE signature = ?")
      .get(signature);
    if (existing) {
      res.status(409).json({ error: "Deposit already processed" });
      return;
    }

    const minLamports = solToLamports(config.minBetSol);
    const verification = await verifyDeposit(
      signature,
      walletAddress,
      minLamports,
    );

    if (!verification.valid) {
      res.status(400).json({ error: verification.error ?? "Invalid deposit" });
      return;
    }

    getOrCreateUser(walletAddress);
    const newBalance = updateBalance(walletAddress, verification.amount);

    const depositId = uuidv4();
    db.prepare(
      "INSERT INTO deposits (id, wallet_address, signature, amount_lamports) VALUES (?, ?, ?, ?)",
    ).run(depositId, walletAddress, signature, verification.amount);

    res.json({
      success: true,
      amountSol: lamportsToSol(verification.amount),
      balanceSol: lamportsToSol(newBalance),
      signature,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Deposit verification failed",
    });
  }
});

apiRouter.post("/withdraw", async (req, res) => {
  try {
    const { walletAddress, amountSol } = req.body as {
      walletAddress?: string;
      amountSol?: number;
    };

    if (!walletAddress || !amountSol) {
      res.status(400).json({ error: "walletAddress and amountSol required" });
      return;
    }

    if (amountSol < config.minWithdrawSol) {
      res.status(400).json({
        error: `Minimum withdrawal is ${config.minWithdrawSol} SOL`,
      });
      return;
    }

    const lamports = solToLamports(amountSol);
    const user = getOrCreateUser(walletAddress);

    if (user.balance_lamports < lamports) {
      res.status(400).json({ error: "Insufficient casino balance" });
      return;
    }

    if (!isWithdrawalEnabled()) {
      res.status(503).json({
        error:
          "Automated withdrawals not configured. Contact support or set CASINO_WALLET_PRIVATE_KEY.",
      });
      return;
    }

    updateBalance(walletAddress, -lamports);

    try {
      const { signature } = await sendWithdrawal(walletAddress, lamports);
      const withdrawalId = uuidv4();
      db.prepare(
        "INSERT INTO withdrawals (id, wallet_address, amount_lamports, signature, status) VALUES (?, ?, ?, ?, 'complete')",
      ).run(withdrawalId, walletAddress, lamports, signature);

      const newBalance = db
        .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
        .get(walletAddress) as { balance_lamports: number };

      res.json({
        success: true,
        signature,
        amountSol,
        balanceSol: lamportsToSol(newBalance.balance_lamports),
      });
    } catch (withdrawErr) {
      updateBalance(walletAddress, lamports);
      throw withdrawErr;
    }
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Withdrawal failed",
    });
  }
});

apiRouter.post("/coinflip", (req, res) => {
  try {
    const { walletAddress, amountSol, choice, clientSeed } = req.body as {
      walletAddress?: string;
      amountSol?: number;
      choice?: "heads" | "tails";
      clientSeed?: string;
    };

    if (!walletAddress || !amountSol || !choice) {
      res.status(400).json({
        error: "walletAddress, amountSol, and choice required",
      });
      return;
    }

    if (amountSol < config.minBetSol || amountSol > config.maxBetSol) {
      res.status(400).json({
        error: `Bet must be between ${config.minBetSol} and ${config.maxBetSol} SOL`,
      });
      return;
    }

    const result = placeCoinflipBet({
      walletAddress,
      amountLamports: solToLamports(amountSol),
      choice,
      clientSeed,
    });

    const updatedUser = db
      .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
      .get(walletAddress) as { balance_lamports: number };

    res.json({
      ...result,
      payoutSol: lamportsToSol(result.payoutLamports),
      balanceSol: lamportsToSol(updatedUser.balance_lamports),
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Coinflip bet failed",
    });
  }
});

apiRouter.get("/history/:walletAddress", (req, res) => {
  const bets = db
    .prepare(
      "SELECT id, game, amount_lamports, payout_lamports, multiplier, result, created_at FROM bets WHERE wallet_address = ? ORDER BY created_at DESC LIMIT 50",
    )
    .all(req.params.walletAddress) as Array<{
      id: string;
      game: string;
      amount_lamports: number;
      payout_lamports: number;
      multiplier: number | null;
      result: string | null;
      created_at: string;
    }>;

  res.json(
    bets.map((b) => ({
      id: b.id,
      game: b.game,
      amountSol: lamportsToSol(b.amount_lamports),
      payoutSol: lamportsToSol(b.payout_lamports),
      multiplier: b.multiplier,
      result: b.result,
      createdAt: b.created_at,
    })),
  );
});

apiRouter.get("/leaderboard", (_req, res) => {
  const leaders = db
    .prepare(
      "SELECT wallet_address, total_wagered_lamports, total_won_lamports, balance_lamports FROM users WHERE total_wagered_lamports > 0 ORDER BY total_wagered_lamports DESC LIMIT 20",
    )
    .all() as Array<{
      wallet_address: string;
      total_wagered_lamports: number;
      total_won_lamports: number;
      balance_lamports: number;
    }>;

  res.json(
    leaders.map((l, i) => ({
      rank: i + 1,
      walletAddress:
        l.wallet_address.slice(0, 4) + "..." + l.wallet_address.slice(-4),
      totalWageredSol: lamportsToSol(l.total_wagered_lamports),
      totalWonSol: lamportsToSol(l.total_won_lamports),
      balanceSol: lamportsToSol(l.balance_lamports),
    })),
  );
});

apiRouter.get("/casino/stats", async (_req, res) => {
  const casinoBalance = await getCasinoWalletBalance();
  const totalUsers = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };
  const totalBets = db
    .prepare("SELECT COUNT(*) as count FROM bets")
    .get() as { count: number };

  res.json({
    casinoWallet: config.casinoWalletAddress,
    casinoBalanceSol: lamportsToSol(casinoBalance),
    totalUsers: totalUsers.count,
    totalBets: totalBets.count,
    withdrawalsEnabled: isWithdrawalEnabled(),
  });
});
