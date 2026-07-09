import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { db, getOrCreateUser, updateBalance, deductBalanceIfSufficient, recordBet } from "../db/index.js";
import { config, lamportsToSol, solToLamports, getPublicRpcSetup, maskRpcUrl } from "../config.js";
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
  creditPlayerOnChain,
} from "../services/anchor.js";
import { getPublicProfile, updateDisplayName, upsertUserProfile, mapAuthProvider } from "../services/profile.js";
import { createGamePrepare, revealGamePrepare, purgeExpiredPrepares } from "../services/gamePrepare.js";
import { applyReferralOnSignup, ensureReferralCode, getAffiliateStats, claimAffiliateCommission } from "../services/affiliate.js";
import { isCasinoPaused } from "../services/pause.js";
import { claimRakeback, getPendingRakebackLamports, getVipTier } from "../services/vip.js";
import { getTournamentLeaderboard } from "../services/tournament.js";
import { placeLimboBet, LIMBO_MIN_TARGET, LIMBO_MAX_TARGET, recordBetWithRewards } from "../services/limbo.js";
import { registerOnChainCrashBet } from "../services/crashKeeper.js";
import {
  verifyCrashPoint,
  generateCoinflipResult,
  generateOnChainCoinflipResult,
  generateServerSeed,
  hashServerSeed,
  hashServerSeedBytes,
  evaluateLimboBet,
  evaluateOnChainLimboBet,
  LIMBO_HOUSE_EDGE,
} from "../services/provablyFair.js";
import {
  requireAuth,
  requireMatchingWallet,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export const apiRouter = Router();

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

apiRouter.use(globalLimiter);

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
  const rpcSetup = getPublicRpcSetup();
  res.json({
    status: rpc.healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    rpc: {
      ...rpc,
      endpoint: maskRpcUrl(rpc.endpoint),
      provider: rpcSetup.provider,
      alchemyConfigured: rpcSetup.alchemyConfigured,
      cluster: rpcSetup.cluster,
    },
    withdrawalsEnabled: isWithdrawalEnabled(),
  });
});

apiRouter.get("/config", async (_req, res) => {
  const pdas = getPdaAddresses();
  const onChain = isAnchorEnabled();
  const casino = onChain ? await fetchCasinoAccount() : null;
  const paused = await isCasinoPaused();

  const rpcSetup = getPublicRpcSetup();

  res.json({
    casinoWallet: config.casinoWalletAddress,
    programId: config.programId,
    cluster: config.solanaCluster,
    solanaRpcUrl: config.solanaRpcUrl,
    rpcProvider: rpcSetup.provider,
    alchemyConfigured: rpcSetup.alchemyConfigured,
    onChainEnabled: onChain,
    casinoInitialized: Boolean(casino),
    casinoPaused: paused,
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
    limboHouseEdge: LIMBO_HOUSE_EDGE,
    limboMinTarget: LIMBO_MIN_TARGET,
    limboMaxTarget: LIMBO_MAX_TARGET,
    withdrawalsEnabled: onChain || isWithdrawalEnabled(),
    socialLoginEnabled: Boolean(process.env.PHANTOM_APP_ID),
    adminWallet: config.adminWallet || undefined,
    rpcEndpoints: getRpcEndpoints().map((url) => maskRpcUrl(url)),
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
  const { walletAddress, signature, message, authProvider, email, displayName, referralCode } =
    req.body as {
      walletAddress?: string;
      signature?: string;
      message?: string;
      authProvider?: string;
      email?: string;
      displayName?: string;
      referralCode?: string;
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

  const profile = upsertUserProfile(walletAddress, {
    authProvider: mapAuthProvider(authProvider),
    email: email?.trim() || undefined,
    displayName: displayName?.trim() || undefined,
  });
  applyReferralOnSignup(walletAddress, referralCode?.trim());
  ensureReferralCode(walletAddress);
  const token = createSessionToken(walletAddress);

  res.json({
    token,
    walletAddress,
    expiresIn: "7d",
    profile: {
      displayName: profile.display_name,
      email: profile.email,
      authProvider: profile.auth_provider,
    },
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
      const publicProfile = getPublicProfile(walletAddress);
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

      const vip = getVipTier(walletAddress);
      const rakebackPendingSol = lamportsToSol(
        getPendingRakebackLamports(walletAddress),
      );
      const affiliate = getAffiliateStats(walletAddress);
      const netPnlSol = lamportsToSol(totalWon - totalWagered);

      res.json({
        walletAddress: user.wallet_address,
        displayName: publicProfile.displayName,
        email: user.email ?? null,
        authProvider: publicProfile.authProvider,
        balanceSol: lamportsToSol(balanceLamports),
        balanceLamports,
        onChainBalanceSol: lamportsToSol(onChainBalance),
        totalWageredSol: lamportsToSol(totalWagered),
        totalWonSol: lamportsToSol(totalWon),
        netPnlSol,
        vipTier: vip.tier,
        vipLabel: vip.label,
        vipRakebackPercent: vip.rakebackPercent,
        wagered30dSol: vip.wagered30dSol,
        nextVipTier: vip.nextTier,
        nextVipWagerSol: vip.nextTierWagerSol,
        rakebackPendingSol,
        referralCode: affiliate.referralCode,
        referralLink: affiliate.referralLink,
        referredCount: affiliate.referredCount,
        pendingCommissionSol: affiliate.pendingCommissionSol,
        playerInitialized: Boolean(player),
        onChainEnabled: isAnchorEnabled(),
        memberSince: user.created_at,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to fetch user",
      });
    }
  },
);

apiRouter.patch(
  "/profile",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    try {
      const { displayName } = req.body as { displayName?: string };
      if (!displayName) {
        res.status(400).json({ error: "displayName required" });
        return;
      }

      const profile = updateDisplayName(req.walletAddress!, displayName);
      res.json({
        walletAddress: profile.wallet_address,
        displayName: profile.display_name,
        email: profile.email,
        authProvider: profile.auth_provider,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Profile update failed",
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

      if (!isWithdrawalEnabled()) {
        res.status(503).json({
          error:
            "Instant withdrawals are unavailable — CASINO_WALLET_PRIVATE_KEY is not configured on the server. Your balance was not changed.",
          withdrawalsEnabled: false,
        });
        return;
      }

      const newBalance = deductBalanceIfSufficient(walletAddress, lamports);
      if (newBalance === null) {
        res.status(400).json({ error: "Insufficient casino balance" });
        return;
      }

      try {
        const { signature } = await sendWithdrawal(walletAddress, lamports);
        const withdrawalId = uuidv4();
        db.prepare(
          "INSERT INTO withdrawals (id, wallet_address, amount_lamports, signature, status) VALUES (?, ?, ?, ?, 'complete')",
        ).run(withdrawalId, walletAddress, lamports, signature);

        res.json({
          success: true,
          signature,
          amountSol,
          balanceSol: lamportsToSol(newBalance),
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
    const { walletAddress, clientSeed } = req.body as {
      walletAddress?: string;
      clientSeed?: string;
    };
    if (!walletAddress || walletAddress !== req.walletAddress) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    purgeExpiredPrepares();
    const prepared = createGamePrepare({
      walletAddress,
      game: "coinflip",
      clientSeed,
    });

    res.json(prepared);
  },
);

apiRouter.post(
  "/coinflip/reveal",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const { walletAddress, prepareId } = req.body as {
      walletAddress?: string;
      prepareId?: string;
    };
    if (!walletAddress || walletAddress !== req.walletAddress || !prepareId) {
      res.status(400).json({ error: "walletAddress and prepareId required" });
      return;
    }

    try {
      const revealed = revealGamePrepare(prepareId, walletAddress);
      res.json({
        serverSeed: revealed.serverSeed,
        serverSeedHash: revealed.serverSeedHash,
        clientSeed: revealed.clientSeed,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Reveal failed",
      });
    }
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

    recordBetWithRewards({
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

apiRouter.post(
  "/limbo",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    try {
      const { walletAddress, amountSol, targetMultiplier, clientSeed } =
        req.body as {
          walletAddress?: string;
          amountSol?: number;
          targetMultiplier?: number;
          clientSeed?: string;
        };

      if (!walletAddress || walletAddress !== req.walletAddress) {
        res.status(403).json({ error: "Unauthorized bet" });
        return;
      }

      if (isAnchorEnabled()) {
        res.status(400).json({
          error: "Use on-chain limbo via /api/limbo/prepare",
        });
        return;
      }

      if (!amountSol || !targetMultiplier) {
        res.status(400).json({ error: "amountSol and targetMultiplier required" });
        return;
      }

      if (amountSol < config.minBetSol || amountSol > config.maxBetSol) {
        res.status(400).json({
          error: `Bet must be between ${config.minBetSol} and ${config.maxBetSol} SOL`,
        });
        return;
      }

      const result = placeLimboBet({
        walletAddress,
        amountLamports: solToLamports(amountSol),
        targetMultiplier,
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
        error: err instanceof Error ? err.message : "Limbo bet failed",
      });
    }
  },
);

apiRouter.post(
  "/limbo/prepare",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const { walletAddress, targetMultiplier, clientSeed } = req.body as {
      walletAddress?: string;
      targetMultiplier?: number;
      clientSeed?: string;
    };
    if (!walletAddress || walletAddress !== req.walletAddress) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }
    if (!targetMultiplier) {
      res.status(400).json({ error: "targetMultiplier required" });
      return;
    }

    purgeExpiredPrepares();
    const prepared = createGamePrepare({
      walletAddress,
      game: "limbo",
      clientSeed,
      metadata: { targetMultiplier },
    });
    res.json(prepared);
  },
);

apiRouter.post(
  "/limbo/reveal",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const { walletAddress, prepareId } = req.body as {
      walletAddress?: string;
      prepareId?: string;
    };
    if (!walletAddress || walletAddress !== req.walletAddress || !prepareId) {
      res.status(400).json({ error: "walletAddress and prepareId required" });
      return;
    }
    try {
      const revealed = revealGamePrepare(prepareId, walletAddress);
      res.json({
        serverSeed: revealed.serverSeed,
        serverSeedHash: revealed.serverSeedHash,
        clientSeed: revealed.clientSeed,
        targetMultiplier: revealed.metadata?.targetMultiplier as number | undefined,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Reveal failed",
      });
    }
  },
);

apiRouter.post(
  "/limbo/confirm",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const {
      walletAddress,
      amountSol,
      targetMultiplier,
      clientSeed,
      serverSeed,
      signature,
    } = req.body as {
      walletAddress?: string;
      amountSol?: number;
      targetMultiplier?: number;
      clientSeed?: string;
      serverSeed?: string;
      signature?: string;
    };

    if (!walletAddress || walletAddress !== req.walletAddress) {
      res.status(403).json({ error: "Unauthorized bet" });
      return;
    }

    if (
      !amountSol ||
      !targetMultiplier ||
      !clientSeed ||
      !serverSeed ||
      !signature
    ) {
      res.status(400).json({ error: "Missing limbo confirmation fields" });
      return;
    }

    const { roll, won } = evaluateOnChainLimboBet({
      serverSeedHex: serverSeed,
      walletAddress,
      clientSeedHex: clientSeed,
      targetMultiplier,
    });

    const amountLamports = solToLamports(amountSol);
    const payoutLamports = won
      ? Math.floor(amountLamports * targetMultiplier)
      : 0;
    const betId = uuidv4();

    recordBetWithRewards({
      id: betId,
      walletAddress,
      game: "limbo",
      amountLamports,
      payoutLamports,
      multiplier: won ? targetMultiplier : 0,
      result: won ? "win" : "loss",
      metadata: {
        targetMultiplier,
        roll,
        serverSeedHash: hashServerSeedBytes(serverSeed),
        serverSeed,
        clientSeed,
        signature,
        onChain: true,
      },
    });

    res.json({
      betId,
      targetMultiplier,
      roll,
      won,
      resultMultiplier: won ? targetMultiplier : 0,
      payoutSol: lamportsToSol(payoutLamports),
      signature,
      serverSeedHash: hashServerSeedBytes(serverSeed),
      serverSeed,
      clientSeed,
    });
  },
);

apiRouter.get(
  "/affiliate",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    res.json(getAffiliateStats(req.walletAddress!));
  },
);

apiRouter.post(
  "/affiliate/claim",
  requireAuth,
  betLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await claimAffiliateCommission(req.walletAddress!);
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Affiliate claim failed",
      });
    }
  },
);

apiRouter.post(
  "/rakeback/claim",
  requireAuth,
  betLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const pending = getPendingRakebackLamports(walletAddress);

      if (isAnchorEnabled()) {
        if (pending < solToLamports(0.001)) {
          res.status(400).json({ error: "Minimum rakeback claim is 0.001 SOL" });
          return;
        }

        const vip = getVipTier(walletAddress);
        db.prepare(
          "UPDATE users SET rakeback_pending_lamports = 0 WHERE wallet_address = ?",
        ).run(walletAddress);

        const signature = await creditPlayerOnChain(walletAddress, pending);
        if (!signature) {
          db.prepare(
            "UPDATE users SET rakeback_pending_lamports = rakeback_pending_lamports + ? WHERE wallet_address = ?",
          ).run(pending, walletAddress);
          res.status(500).json({ error: "On-chain rakeback credit failed" });
          return;
        }

        db.prepare(
          `INSERT INTO rakeback_claims (id, wallet_address, amount_lamports, vip_tier)
           VALUES (?, ?, ?, ?)`,
        ).run(uuidv4(), walletAddress, pending, vip.tier);

        res.json({
          claimedSol: lamportsToSol(pending),
          balanceSol: null,
          signature,
          onChain: true,
        });
        return;
      }

      const result = claimRakeback(walletAddress);
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Claim failed",
      });
    }
  },
);

apiRouter.post(
  "/crash/confirm",
  requireAuth,
  betLimiter,
  (req: AuthenticatedRequest, res) => {
    const {
      walletAddress,
      roundId,
      amountSol,
      autoCashout,
      signature,
    } = req.body as {
      walletAddress?: string;
      roundId?: number;
      amountSol?: number;
      autoCashout?: number;
      signature?: string;
    };

    if (!walletAddress || walletAddress !== req.walletAddress) {
      res.status(403).json({ error: "Unauthorized bet" });
      return;
    }

    if (!roundId || !amountSol || !signature) {
      res.status(400).json({ error: "roundId, amountSol, and signature required" });
      return;
    }

    registerOnChainCrashBet({
      roundId,
      walletAddress,
      autoCashoutMultiplier: autoCashout,
    });

    const amountLamports = solToLamports(amountSol);
    const betId = uuidv4();

    recordBetWithRewards({
      id: betId,
      walletAddress,
      game: "crash",
      amountLamports,
      payoutLamports: 0,
      multiplier: 0,
      result: "pending",
      metadata: {
        roundId,
        autoCashout,
        signature,
        onChain: true,
      },
    });

    res.json({ betId, roundId, signature });
  },
);

apiRouter.get("/tournament", (_req, res) => {
  res.json(getTournamentLeaderboard());
});

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
      `SELECT wallet_address, display_name, total_wagered_lamports, total_won_lamports, balance_lamports
       FROM users WHERE total_wagered_lamports > 0 ORDER BY total_wagered_lamports DESC LIMIT 20`,
    )
    .all() as Array<{
      wallet_address: string;
      display_name: string | null;
      total_wagered_lamports: number;
      total_won_lamports: number;
      balance_lamports: number;
    }>;

  res.json(
    leaders.map((l, i) => ({
      rank: i + 1,
      walletAddress:
        l.wallet_address.slice(0, 4) + "..." + l.wallet_address.slice(-4),
      displayName: l.display_name ?? `Player_${l.wallet_address.slice(0, 4)}`,
      totalWageredSol: lamportsToSol(l.total_wagered_lamports),
      totalWonSol: lamportsToSol(l.total_won_lamports),
      balanceSol: lamportsToSol(l.balance_lamports),
    })),
  );
});

apiRouter.get("/recent-wins", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT b.wallet_address, b.game, b.payout_lamports, b.amount_lamports, b.multiplier, u.display_name
       FROM bets b
       LEFT JOIN users u ON u.wallet_address = b.wallet_address
       WHERE b.result = 'win' AND b.payout_lamports > b.amount_lamports
       ORDER BY b.created_at DESC LIMIT 24`,
    )
    .all() as Array<{
      wallet_address: string;
      game: string;
      payout_lamports: number;
      amount_lamports: number;
      multiplier: number | null;
      display_name: string | null;
    }>;

  res.json(
    rows.map((r) => ({
      walletAddress: r.wallet_address,
      displayName: r.display_name ?? undefined,
      game: r.game,
      payoutSol: lamportsToSol(r.payout_lamports),
      amountSol: lamportsToSol(r.amount_lamports),
      multiplier: r.multiplier ?? undefined,
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

  const last24h = db
    .prepare(
      `SELECT
        COALESCE(SUM(amount_lamports), 0) as handle,
        COALESCE(SUM(amount_lamports - payout_lamports), 0) as gross
       FROM bets WHERE created_at >= datetime('now', '-1 day')`,
    )
    .get() as { handle: number; gross: number };

  const affiliatePaid = db
    .prepare(
      "SELECT COALESCE(SUM(commission_lamports), 0) as total FROM affiliate_earnings",
    )
    .get() as { total: number };

  const tournament = getTournamentLeaderboard();

  res.json({
    casinoWallet: config.casinoWalletAddress,
    casinoBalanceSol: lamportsToSol(casinoBalance),
    totalUsers: totalUsers.count,
    totalBets: totalBets.count,
    pendingWithdrawals: pendingWithdrawals.count,
    withdrawalsEnabled: isWithdrawalEnabled(),
    handle24hSol: lamportsToSol(last24h.handle),
    grossRevenue24hSol: lamportsToSol(last24h.gross),
    affiliateCommissionsSol: lamportsToSol(affiliatePaid.total),
    tournamentPrizePoolSol: tournament.prizePoolSol,
    tournamentWeekEnd: tournament.weekEnd,
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

apiRouter.post("/fairness/verify-limbo", (req, res) => {
  const { serverSeed, betId, clientSeed, targetMultiplier, expectedWon } =
    req.body as {
      serverSeed?: string;
      betId?: string;
      clientSeed?: string;
      targetMultiplier?: number;
      expectedWon?: boolean;
    };

  if (
    !serverSeed ||
    !betId ||
    !clientSeed ||
    targetMultiplier === undefined ||
    expectedWon === undefined
  ) {
    res.status(400).json({ error: "Missing verification parameters" });
    return;
  }

  const evaluation = evaluateLimboBet({
    serverSeed,
    betId,
    clientSeed,
    targetMultiplier,
  });

  res.json({
    valid: evaluation.won === expectedWon,
    roll: evaluation.roll,
    won: evaluation.won,
    serverSeedHash: hashServerSeed(serverSeed),
  });
});
