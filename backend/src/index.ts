import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config, solToLamports, lamportsToSol } from "./config.js";
import { apiRouter } from "./routes/api.js";
import { crashEngine } from "./services/crash.js";
import { getOrCreateUser } from "./db/index.js";
import { requireAuthSocket } from "./middleware/auth.js";
import { checkRpcHealth } from "./services/solana.js";
import { getRecentChatMessages, sendChatMessage } from "./services/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());
app.use("/api", apiRouter);

function broadcastOnlineCount(): void {
  io.emit("site:online", { count: io.engine.clientsCount });
}

io.use(requireAuthSocket);

io.on("connection", (socket) => {
  const walletAddress = socket.data.walletAddress as string;
  socket.emit("crash:state", crashEngine.getFullStateForWallet(walletAddress));
  socket.emit("chat:history", getRecentChatMessages());
  broadcastOnlineCount();

  socket.on("disconnect", () => {
    setTimeout(broadcastOnlineCount, 100);
  });

  socket.on("crash:subscribe", () => {
    socket.emit("crash:state", crashEngine.getFullStateForWallet(walletAddress));
  });

  socket.on(
    "crash:bet",
    (
      data: { amountSol: number; autoCashout?: number },
      callback?: (response: unknown) => void,
    ) => {
      try {
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

  socket.on("crash:cashout", (callback?: (response: unknown) => void) => {
    try {
      const bet = crashEngine.cashout(walletAddress);
      const user = getOrCreateUser(walletAddress);
      const response = {
        success: true,
        bet,
        balanceSol: lamportsToSol(user.balance_lamports),
      };
      callback?.(response);
      io.emit("crash:state", crashEngine.getState());
      io.emit("crash:player_cashout", {
        walletAddress:
          walletAddress.slice(0, 4) + "..." + walletAddress.slice(-4),
        multiplier: bet.cashoutMultiplier,
        payoutSol: lamportsToSol(bet.payoutLamports),
      });
    } catch (err) {
      callback?.({
        success: false,
        error: err instanceof Error ? err.message : "Cashout failed",
      });
    }
  });

  socket.on(
    "chat:send",
    (data: { message: string }, callback?: (response: unknown) => void) => {
      try {
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

const frontendDist = path.join(__dirname, "../../frontend/dist");
if (config.serveFrontend && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  console.log(`Serving frontend from ${frontendDist}`);
}

async function start(): Promise<void> {
  const rpc = await checkRpcHealth();
  if (!rpc.healthy) {
    console.warn("Warning: RPC health check failed — deposits may be slow");
  } else {
    console.log(`RPC connected: ${rpc.endpoint} (slot ${rpc.slot})`);
  }

  httpServer.listen(config.port, () => {
    console.log(`SolCasino backend running on port ${config.port}`);
    console.log(`Casino wallet: ${config.casinoWalletAddress}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(
      `Withdrawals: ${process.env.CASINO_WALLET_PRIVATE_KEY ? "enabled" : "queued mode"}`,
    );
  });
}

start().catch(console.error);
