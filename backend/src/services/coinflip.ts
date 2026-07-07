import { v4 as uuidv4 } from "uuid";
import { db, recordBet, updateBalance } from "../db/index.js";
import {
  generateCoinflipResult,
  generateServerSeed,
  hashServerSeed,
} from "./provablyFair.js";
import { config } from "../config.js";

const COINFLIP_PAYOUT_MULTIPLIER = 1 - config.houseEdge;

export interface CoinflipBetRequest {
  walletAddress: string;
  amountLamports: number;
  choice: "heads" | "tails";
  clientSeed?: string;
}

export interface CoinflipBetResult {
  betId: string;
  choice: "heads" | "tails";
  result: "heads" | "tails";
  won: boolean;
  payoutLamports: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
}

export function placeCoinflipBet(
  request: CoinflipBetRequest,
): CoinflipBetResult {
  const user = db
    .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
    .get(request.walletAddress) as { balance_lamports: number } | undefined;

  if (!user || user.balance_lamports < request.amountLamports) {
    throw new Error("Insufficient balance");
  }

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const clientSeed = request.clientSeed ?? uuidv4();
  const betId = uuidv4();

  const result = generateCoinflipResult(serverSeed, betId, clientSeed);
  const won = result === request.choice;
  const payoutLamports = won
    ? Math.floor(request.amountLamports * 2 * COINFLIP_PAYOUT_MULTIPLIER)
    : 0;

  updateBalance(request.walletAddress, -request.amountLamports);
  if (payoutLamports > 0) {
    updateBalance(request.walletAddress, payoutLamports);
  }

  recordBet({
    id: betId,
    walletAddress: request.walletAddress,
    game: "coinflip",
    amountLamports: request.amountLamports,
    payoutLamports,
    multiplier: won ? 2 * COINFLIP_PAYOUT_MULTIPLIER : 0,
    result: won ? "win" : "loss",
    metadata: {
      choice: request.choice,
      flipResult: result,
      serverSeedHash,
      serverSeed,
      clientSeed,
    },
  });

  return {
    betId,
    choice: request.choice,
    result,
    won,
    payoutLamports,
    serverSeedHash,
    serverSeed,
    clientSeed,
  };
}
