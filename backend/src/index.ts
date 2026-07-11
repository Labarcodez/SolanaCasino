import "dotenv/config";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config, solToLamports, lamportsToSol, getPublicRpcSetup, isAlchemyRpcConfigured } from "./config.js";
import { apiRouter } from "./routes/api.js";
import { adminRouter } from "./routes/admin.js";
import { tokenRouter } from "./routes/token.js";
import { crashEngine } from "./services/crash.js";
import { startCrashKeeper } from "./services/crashKeeper.js";
import { startBetIndexer } from "./services/indexer.js";
import { getOrCreateUser } from "./db/index.js";
import { attachSocketAuth } from "./middleware/auth.js";
import { checkRpcHealth } from "./services/solana.js";
import { getRecentChatMessages, sendChatMessage } from "./services/chat.js";
import { isCasinoPaused } from "./services/pause.js";
import { initializeCasinoIfNeeded, isAnchorEnabled, fetchCasinoAccount } from "./services/anchor.js";

const socketRateLimits = new Map<string, number>();
const SOCKET_COOLDOWN_MS = 500;

function checkSocketRateLimit(wallet: string): boolean {
  const now = Date.now();
  const last = socketRateLimits.get(wallet) ?? 0;
  if (now - last < SOCKET_COOLDOWN_MS) return false;
  socketRateLimits.set(wallet, now);
  return true;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...config.corsOrigins,
].filter((v, i, a) => a.indexOf(v) === i);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use("/api", apiRouter);
app.use("/api/token", tokenRouter);
app.use("/api/admin", adminRouter);

function broadcastOnlineCount(): void {
  io.emit("site:online", { count: io.engine.clientsCount });
}

io.use(attachSocketAuth);

io.on("connection", (socket) => {
  const isSpectator = Boolean(socket.data.isSpectator);
  const walletAddress = socket.data.walletAddress as string | null;

  socket.emit(
    "crash:state",
    isSpectator || !walletAddress
      ? crashEngine.getState()
      : crashEngine.getFullStateForWallet(walletAddress),
  );
  socket.emit("chat:history", getRecentChatMessages());
  broadcastOnlineCount();

  socket.on("disconnect", () => {
    setTimeout(broadcastOnlineCount, 100);
  });

  socket.on("crash:subscribe", () => {
    socket.emit(
      "crash:state",
      isSpectator || !walletAddress
        ? crashEngine.getState()
        : crashEngine.getFullStateForWallet(walletAddress),
    );
  });

  socket.on(
    "crash:bet",
    async (
      data: { amountSol: number; autoCashout?: number; slot?: 0 | 1 },
      callback?: (response: unknown) => void,
    ) => {
      try {
        if (isSpectator || !walletAddress) {
          throw new Error("Connect wallet to place bets");
        }
        if (await isCasinoPaused()) {
          throw new Error("Casino is paused");
        }

        if (!checkSocketRateLimit(walletAddress)) {
          throw new Error("Too many requests — slow down");
        }

        if (
          data.amountSol < config.minBetSol ||
          data.amountSol > config.maxBetSol
        ) {
          throw new Error(
            `Bet must be between ${config.minBetSol} and ${config.maxBetSol} SOL`,
          );
        }

        getOrCreateUser(walletAddress);
        const bet = crashEngine.placeBet(
          walletAddress,
          solToLamports(data.amountSol),
          data.autoCashout,
          data.slot === 1 ? 1 : 0,
        );

        const user = getOrCreateUser(walletAddress);
        const response = {
          success: true,
          bet,
          balanceSol: lamportsToSol(user.balance_lamports),
        };
        callback?.(response);
        io.emit("crash:state", crashEngine.getState());
        io.emit("crash:bet_placed", {
          walletAddress:
            walletAddress.slice(0, 4) + "..." + walletAddress.slice(-4),
          amountSol: data.amountSol,
          autoCashout: data.autoCashout,
        });
      } catch (err) {
        callback?.({
          success: false,
          error: err instanceof Error ? err.message : "Bet failed",
        });
      }
    },
  );

  socket.on(
    "crash:cashout",
    async (
      data: { slot?: 0 | 1 } | ((response: unknown) => void) | undefined,
      callback?: (response: unknown) => void,
    ) => {
    let slot: 0 | 1 = 0;
    let ack = callback;
    if (typeof data === "function") {
      ack = data;
    } else if (data?.slot === 1) {
      slot = 1;
    }

    try {
      if (isSpectator || !walletAddress) {
        throw new Error("Connect wallet to cash out");
      }
      if (await isCasinoPaused()) {
        throw new Error("Casino is paused");
      }
      if (!checkSocketRateLimit(walletAddress)) {
        throw new Error("Too many requests — slow down");
      }
      const bet = crashEngine.cashout(walletAddress, slot);
      const user = getOrCreateUser(walletAddress);
      const response = {
        success: true,
        bet,
        balanceSol: lamportsToSol(user.balance_lamports),
      };
      ack?.(response);
      io.emit("crash:state", crashEngine.getState());
      io.emit("crash:player_cashout", {
        walletAddress:
          walletAddress.slice(0, 4) + "..." + walletAddress.slice(-4),
        multiplier: bet.cashoutMultiplier,
        payoutSol: lamportsToSol(bet.payoutLamports),
      });
    } catch (err) {
      ack?.({
        success: false,
        error: err instanceof Error ? err.message : "Cashout failed",
      });
    }
  });

  socket.on(
    "chat:send",
    (data: { message: string }, callback?: (response: unknown) => void) => {
      try {
        if (isSpectator || !walletAddress) {
          throw new Error("Connect wallet to chat");
        }
        const msg = sendChatMessage(walletAddress, data.message);
        io.emit("chat:message", msg);
        callback?.({ success: true, message: msg });
      } catch (err) {
        callback?.({
          success: false,
          error: err instanceof Error ? err.message : "Failed to send message",
        });
      }
    },
  );
});

crashEngine.on("round_start", (state) => {
  io.emit("crash:round_start", state);
});

crashEngine.on("round_running", (state) => {
  io.emit("crash:round_running", state);
});

crashEngine.on("tick", (data) => {
  io.emit("crash:tick", data);
});

crashEngine.on("crash", (data) => {
  io.emit("crash:crashed", data);
});

crashEngine.on("bet_placed", () => {
  io.emit("crash:state", crashEngine.getState());
});

crashEngine.on("cashout", ({ bet, multiplier }) => {
  io.emit("crash:state", crashEngine.getState());
  io.emit("crash:player_cashout", {
    walletAddress:
      bet.walletAddress.slice(0, 4) + "..." + bet.walletAddress.slice(-4),
    multiplier,
    payoutSol: lamportsToSol(bet.payoutLamports),
  });
});

const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  crash: "/crash",
  coinflip: "/coinflip",
  limbo: "/limbo",
  leaderboard: "/leaderboard",
  tournament: "/tournament",
  fairness: "/fairness",
  profile: "/profile",
  wallet: "/wallet",
  token: "/token",
  launch: "/launch",
  admin: "/admin",
};

const frontendDist = path.join(__dirname, "../../frontend/dist");
if (config.serveFrontend && fs.existsSync(frontendDist)) {
  app.get("/", (req, res) => {
    const tab = req.query.tab;
    if (typeof tab === "string") {
      const target = LEGACY_TAB_REDIRECTS[tab];
      if (target) {
        const q = new URLSearchParams();
        for (const [key, value] of Object.entries(req.query)) {
          if (key === "tab" || value === undefined) continue;
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === "string") q.append(key, item);
            }
          } else if (typeof value === "string") {
            q.set(key, value);
          }
        }
        const qs = q.toString();
        res.redirect(302, qs ? `${target}?${qs}` : target);
        return;
      }
    }
    res.redirect(302, "/crash");
  });

  app.use(
    express.static(frontendDist, {
      maxAge: config.nodeEnv === "production" ? "7d" : 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }),
  );
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  console.log(`Serving frontend from ${frontendDist}`);
}

function shutdown(signal: string): void {
  console.log(`${signal} received — shutting down`);
  crashEngine.destroy();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function start(): Promise<void> {
  const rpc = await checkRpcHealth();
  if (!rpc.healthy) {
    console.warn("Warning: RPC health check failed — deposits may be slow");
  } else {
    const setup = getPublicRpcSetup();
    console.log(
      `RPC connected: ${setup.solanaRpcUrl} (${setup.provider}, slot ${rpc.slot})`,
    );
    if (
      config.nodeEnv === "production" &&
      config.solanaCluster === "mainnet-beta" &&
      !isAlchemyRpcConfigured() &&
      !process.env.SOLANA_RPC_URL &&
      !process.env.HELIUS_RPC_URL
    ) {
      console.error(
        "CRITICAL: ALCHEMY_API_KEY is not set — using public mainnet RPC. Deposits will be unreliable. Set ALCHEMY_API_KEY in production env and redeploy.",
      );
    }
  }

  if (isAnchorEnabled()) {
    try {
      const existing = await fetchCasinoAccount();
      if (existing) {
        console.log(`On-chain casino active at ${existing.address}`);
      } else {
        const sig = await initializeCasinoIfNeeded();
        if (sig) {
          console.log(`On-chain casino initialized (tx: ${sig})`);
        }
      }
    } catch (err) {
      console.error(
        "On-chain casino init failed — check PROGRAM_AUTHORITY_PRIVATE_KEY and RPC:",
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.log("Custodial mode — leave PROGRAM_AUTHORITY_PRIVATE_KEY unset for SQLite balances");
  }

  httpServer.listen(config.port, () => {
    console.log(`OrbitCasino backend running on port ${config.port}`);
    console.log(`Casino wallet: ${config.casinoWalletAddress}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(
      `Withdrawals: ${process.env.CASINO_WALLET_PRIVATE_KEY ? "enabled" : "queued mode"}`,
    );
    startCrashKeeper();
    startBetIndexer();
  });
}

start().catch(console.error);
