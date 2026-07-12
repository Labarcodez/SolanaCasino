import { v4 as uuidv4 } from "uuid";
import { db, deductBalanceIfSufficient, updateBalance } from "../db/index.js";
import {
  generateCoinflipResult,
  generateServerSeed,
  hashServerSeed,
} from "./provablyFair.js";
import { config } from "../config.js";
import { recordBetWithRewards } from "./limbo.js";

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
  const balanceAfterDeduct = deductBalanceIfSufficient(
    request.walletAddress,
    request.amountLamports,
  );
  if (balanceAfterDeduct === null) {
    throw new Error("Insufficient balance");
  }

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const clientSeed = uuidv4();
  const betId = uuidv4();

  const result = generateCoinflipResult(serverSeed, betId, clientSeed);
  const won = result === request.choice;
  const payoutLamports = won
    ? Math.floor(request.amountLamports * 2 * COINFLIP_PAYOUT_MULTIPLIER)
    : 0;

  if (payoutLamports > 0) {
    updateBalance(request.walletAddress, payoutLamports);
  }

  recordBetWithRewards({
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
