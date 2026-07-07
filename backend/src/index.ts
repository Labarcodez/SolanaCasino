import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config, solToLamports } from "./config.js";
import { apiRouter } from "./routes/api.js";
import { crashEngine } from "./services/crash.js";
import { getOrCreateUser } from "./db/index.js";
import { lamportsToSol } from "./config.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [config.frontendUrl, "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: [config.frontendUrl, "http://localhost:5173"],
  }),
);
app.use(express.json());
app.use("/api", apiRouter);

io.on("connection", (socket) => {
  socket.emit("crash:state", crashEngine.getState());

  socket.on("crash:subscribe", (walletAddress?: string) => {
    if (walletAddress) {
      socket.emit("crash:state", crashEngine.getFullStateForWallet(walletAddress));
    } else {
      socket.emit("crash:state", crashEngine.getState());
    }
  });

  socket.on(
    "crash:bet",
    (
      data: { walletAddress: string; amountSol: number; autoCashout?: number },
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

        getOrCreateUser(data.walletAddress);
        const bet = crashEngine.placeBet(
          data.walletAddress,
          solToLamports(data.amountSol),
          data.autoCashout,
        );

        const user = getOrCreateUser(data.walletAddress);
        const response = {
          success: true,
          bet,
          balanceSol: lamportsToSol(user.balance_lamports),
        };
        callback?.(response);
        io.emit("crash:bet_placed", {
          walletAddress:
            data.walletAddress.slice(0, 4) +
            "..." +
            data.walletAddress.slice(-4),
          amountSol: data.amountSol,
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
    (
      data: { walletAddress: string },
      callback?: (response: unknown) => void,
    ) => {
      try {
        const bet = crashEngine.cashout(data.walletAddress);
        const user = getOrCreateUser(data.walletAddress);
        const response = {
          success: true,
          bet,
          balanceSol: lamportsToSol(user.balance_lamports),
        };
        callback?.(response);
        io.emit("crash:player_cashout", {
          walletAddress:
            data.walletAddress.slice(0, 4) +
            "..." +
            data.walletAddress.slice(-4),
          multiplier: bet.cashoutMultiplier,
          payoutSol: lamportsToSol(bet.payoutLamports),
        });
      } catch (err) {
        callback?.({
          success: false,
          error: err instanceof Error ? err.message : "Cashout failed",
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

httpServer.listen(config.port, () => {
  console.log(`SolCasino backend running on port ${config.port}`);
  console.log(`Casino wallet: ${config.casinoWalletAddress}`);
  console.log(`Network: ${config.solanaRpcUrl}`);
});
