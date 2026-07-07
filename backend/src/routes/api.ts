import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { db, getOrCreateUser, updateBalance, recordBet } from "../db/index.js";
import { config, lamportsToSol, solToLamports } from "../config.js";
import {
  getCasinoWalletBalance,
  getWalletBalance,
  isWithdrawalEnabled,
  sendWithdrawal,
  verifyDeposit,
  checkRpcHealth,
  getRpcEndpoints,
} from "../services/solana.js";
import { placeCoinflipBet } from "../services/coinflip.js";
import {
  buildAuthMessage,
  consumeAuthNonce,
  createAuthNonce,
  createSessionToken,
  extractNonceFromMessage,
  verifyWalletSignature,
} from "../services/auth.js";
import {
  fetchCasinoAccount,
  fetchPlayerAccount,
  getPdaAddresses,
  isAnchorEnabled,
} from "../services/anchor.js";
import {
  verifyCrashPoint,
  generateCoinflipResult,
  generateOnChainCoinflipResult,
  generateServerSeed,
  hashServerSeed,
  hashServerSeedBytes,
} from "../services/provablyFair.js";
import {
  requireAuth,
  requireMatchingWallet,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export const apiRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const betLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

apiRouter.get("/health", async (_req, res) => {
  const rpc = await checkRpcHealth();
  res.json({
    status: rpc.healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    rpc,
    withdrawalsEnabled: isWithdrawalEnabled(),
  });
});

apiRouter.get("/config", async (_req, res) => {
  const pdas = getPdaAddresses();
  const onChain = isAnchorEnabled();
  const casino = onChain ? await fetchCasinoAccount() : null;

  res.json({
    casinoWallet: config.casinoWalletAddress,
    programId: config.programId,
    cluster: config.solanaCluster,
    onChainEnabled: onChain,
    casinoInitialized: Boolean(casino),
    casinoPda: pdas.casinoPda,
    vaultPda: pdas.vaultPda,
    minBetSol: casino
      ? lamportsToSol(casino.minBetLamports)
      : config.minBetSol,
    maxBetSol: casino
      ? lamportsToSol(casino.maxBetLamports)
      : config.maxBetSol,
    minWithdrawSol: config.minWithdrawSol,
    houseEdge: casino ? casino.houseEdgeBps / 10000 : config.houseEdge,
    withdrawalsEnabled: onChain || isWithdrawalEnabled(),
    socialLoginEnabled: Boolean(process.env.PHANTOM_APP_ID),
    rpcEndpoints: getRpcEndpoints().map((url) =>
      url.includes("api-key") ? url.replace(/api-key=[^&]+/, "api-key=***") : url,
    ),
  });
});

apiRouter.post("/auth/nonce", authLimiter, (req, res) => {
  const { walletAddress } = req.body as { walletAddress?: string };
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress required" });
    return;
  }

  try {
    new PublicKey(walletAddress);
  } catch {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  const nonce = createAuthNonce(walletAddress);
  res.json({
    nonce,
    message: buildAuthMessage(walletAddress, nonce),
  });
});

apiRouter.post("/auth/verify", authLimiter, (req, res) => {
  const { walletAddress, signature, message } = req.body as {
    walletAddress?: string;
    signature?: string;
    message?: string;
  };

  if (!walletAddress || !signature || !message) {
    res.status(400).json({ error: "walletAddress, signature, and message required" });
    return;
  }

  const nonce = extractNonceFromMessage(message);
  if (!nonce || !consumeAuthNonce(walletAddress, nonce)) {
    res.status(401).json({ error: "Invalid or expired nonce" });
    return;
  }

  if (!verifyWalletSignature(message, signature, walletAddress)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  getOrCreateUser(walletAddress);
  const token = createSessionToken(walletAddress);

  res.json({
    token,
    walletAddress,
    expiresIn: "7d",
  });
});

apiRouter.get(
  "/user/:walletAddress",
  requireAuth,
  requireMatchingWallet,
  async (req: AuthenticatedRequest, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const user = getOrCreateUser(walletAddress);
      const onChainBalance = await getWalletBalance(walletAddress);
      const player = isAnchorEnabled()
        ? await fetchPlayerAccount(walletAddress)
        : null;

      const balanceLamports = player
        ? player.balanceLamports
        : user.balance_lamports;
      const totalWagered = player
        ? player.totalWageredLamports
        : user.total_wagered_lamports;
      const totalWon = player
        ? player.totalWonLamports
        : user.total_won_lamports;

      res.json({
        walletAddress: user.wallet_address,
        balanceSol: lamportsToSol(balanceLamports),
        balanceLamports,
        onChainBalanceSol: lamportsToSol(onChainBalance),
        totalWageredSol: lamportsToSol(totalWagered),
        totalWonSol: lamportsToSol(totalWon),
        playerInitialized: Boolean(player),
        onChainEnabled: isAnchorEnabled(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to fetch user",
      });
    }
  },
);

apiRouter.post(
  "/deposit/verify",
  requireAuth,
  betLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { signature, walletAddress } = req.body as {
        signature?: string;
        walletAddress?: string;
      };

      if (!signature || !walletAddress || walletAddress !== req.walletAddress) {
        res.status(403).json({ error: "Unauthorized deposit verification" });
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
  },
);

apiRouter.post(
  "/withdraw",
  requireAuth,
  betLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { walletAddress, amountSol } = req.body as {
        walletAddress?: string;
        amountSol?: number;
      };

      if (!walletAddress || walletAddress !== req.walletAddress || !amountSol) {
        res.status(403).json({ error: "Unauthorized withdrawal" });
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
        updateBalance(walletAddress, -lamports);
        const withdrawalId = uuidv4();
        db.prepare(
          "INSERT INTO withdrawals (id, wallet_address, amount_lamports, status) VALUES (?, ?, ?, 'pending')",
        ).run(withdrawalId, walletAddress, lamports);

        res.json({
          success: true,
          queued: true,
          withdrawalId,
          amountSol,
          balanceSol: lamportsToSol(user.balance_lamports - lamports),
          message:
            "Withdrawal queued — will be processed once casino wallet is configured",
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
  },
);

apiRouter.post(
  "/coinflip/prepare",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const { walletAddress } = req.body as { walletAddress?: string };
    if (!walletAddress || walletAddress !== req.walletAddress) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeedBytes(serverSeed);
    const clientSeed = uuidv4().replace(/-/g, "").slice(0, 32);
    const predicted = generateOnChainCoinflipResult(
      serverSeed,
      walletAddress,
      clientSeed,
    );

    res.json({
      serverSeed,
      serverSeedHash,
      clientSeed,
      predictedResult: predicted,
    });
  },
);

apiRouter.post(
  "/coinflip/confirm",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const {
      walletAddress,
      amountSol,
      choice,
      clientSeed,
      serverSeed,
      signature,
    } = req.body as {
      walletAddress?: string;
      amountSol?: number;
      choice?: "heads" | "tails";
      clientSeed?: string;
      serverSeed?: string;
      signature?: string;
    };

    if (!walletAddress || walletAddress !== req.walletAddress) {
      res.status(403).json({ error: "Unauthorized bet" });
      return;
    }

    if (!amountSol || !choice || !clientSeed || !serverSeed || !signature) {
      res.status(400).json({ error: "Missing coinflip confirmation fields" });
      return;
    }

    const result = generateOnChainCoinflipResult(
      serverSeed,
      walletAddress,
      clientSeed,
    );
    const won = result === choice;
    const betId = uuidv4();

    recordBet({
      id: betId,
      walletAddress,
      game: "coinflip",
      amountLamports: solToLamports(amountSol),
      payoutLamports: 0,
      multiplier: won ? 2 * (1 - config.houseEdge) : 0,
      result: won ? "win" : "loss",
      metadata: {
        choice,
        flipResult: result,
        serverSeedHash: hashServerSeedBytes(serverSeed),
        serverSeed,
        clientSeed,
        signature,
        onChain: true,
      },
    });

    res.json({
      betId,
      choice,
      result,
      won,
      signature,
      serverSeedHash: hashServerSeedBytes(serverSeed),
    });
  },
);

apiRouter.post(
  "/coinflip",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    try {
      const { walletAddress, amountSol, choice, clientSeed } = req.body as {
        walletAddress?: string;
        amountSol?: number;
        choice?: "heads" | "tails";
        clientSeed?: string;
      };

      if (!walletAddress || walletAddress !== req.walletAddress) {
        res.status(403).json({ error: "Unauthorized bet" });
        return;
      }

      if (isAnchorEnabled()) {
        res.status(400).json({
          error: "Use on-chain coinflip via /api/coinflip/prepare",
        });
        return;
      }

      if (!amountSol || !choice) {
        res.status(400).json({
          error: "amountSol and choice required",
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
  },
);

apiRouter.get(
  "/history/:walletAddress",
  requireAuth,
  requireMatchingWallet,
  (req, res) => {
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
  },
);

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
  const pendingWithdrawals = db
    .prepare("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'")
    .get() as { count: number };

  res.json({
    casinoWallet: config.casinoWalletAddress,
    casinoBalanceSol: lamportsToSol(casinoBalance),
    totalUsers: totalUsers.count,
    totalBets: totalBets.count,
    pendingWithdrawals: pendingWithdrawals.count,
    withdrawalsEnabled: isWithdrawalEnabled(),
  });
});

apiRouter.post("/fairness/verify-crash", (req, res) => {
  const { serverSeed, serverSeedHash, roundId, clientSeeds, crashPoint } =
    req.body as {
      serverSeed?: string;
      serverSeedHash?: string;
      roundId?: string;
      clientSeeds?: string[];
      crashPoint?: number;
    };

  if (
    !serverSeed ||
    !serverSeedHash ||
    !roundId ||
    crashPoint === undefined
  ) {
    res.status(400).json({ error: "Missing verification parameters" });
    return;
  }

  const valid = verifyCrashPoint(
    serverSeed,
    serverSeedHash,
    roundId,
    clientSeeds ?? [],
    crashPoint,
  );

  res.json({ valid, crashPoint, serverSeedHash });
});

apiRouter.post("/fairness/verify-coinflip", (req, res) => {
  const { serverSeed, betId, clientSeed, expectedResult } = req.body as {
    serverSeed?: string;
    betId?: string;
    clientSeed?: string;
    expectedResult?: "heads" | "tails";
  };

  if (!serverSeed || !betId || !clientSeed || !expectedResult) {
    res.status(400).json({ error: "Missing verification parameters" });
    return;
  }

  const result = generateCoinflipResult(serverSeed, betId, clientSeed);
  res.json({
    valid: result === expectedResult,
    result,
    serverSeedHash: hashServerSeed(serverSeed),
  });
});
