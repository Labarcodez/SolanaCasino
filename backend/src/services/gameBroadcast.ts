import type { Server } from "socket.io";
import { getDisplayName } from "./profile.js";

let io: Server | null = null;

export function setGameBroadcastIo(server: Server): void {
  io = server;
}

export function broadcastPlayerWin(params: {
  walletAddress: string;
  game: "crash" | "limbo" | "coinflip";
  multiplier: number;
  payoutSol: number;
}): void {
  if (!io || params.payoutSol <= 0) return;

  io.emit("crash:player_cashout", {
    walletAddress:
      params.walletAddress.slice(0, 4) + "..." + params.walletAddress.slice(-4),
    displayName: getDisplayName(params.walletAddress),
    multiplier: params.multiplier,
    payoutSol: params.payoutSol,
    game: params.game,
  });
}
