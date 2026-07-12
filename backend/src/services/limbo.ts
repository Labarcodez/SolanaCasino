import { v4 as uuidv4 } from "uuid";
import { db, deductBalanceIfSufficient, recordBet, updateBalance } from "../db/index.js";
import { config } from "../config.js";
import {
  evaluateLimboBet,
  generateServerSeed,
  hashServerSeed,
  LIMBO_HOUSE_EDGE,
} from "./provablyFair.js";
import { recordAffiliateCommission } from "./affiliate.js";
import { accrueRakeback } from "./vip.js";
import { recordTournamentWager } from "./tournament.js";

const MIN_TARGET = 1.25;
const MAX_TARGET = 1000;

export function validateLimboTarget(targetMultiplier: number): void {
  if (targetMultiplier < MIN_TARGET || targetMultiplier > MAX_TARGET) {
    throw new Error(`Target must be between ${MIN_TARGET}x and ${MAX_TARGET}x`);
  }
}

export interface LimboBetRequest {
  walletAddress: string;
  amountLamports: number;
  targetMultiplier: number;
  clientSeed?: string;
}

export interface LimboBetResult {
  betId: string;
  targetMultiplier: number;
  resultMultiplier: number;
  roll: number;
  won: boolean;
  payoutLamports: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
}

export function placeLimboBet(request: LimboBetRequest): LimboBetResult {
  validateLimboTarget(request.targetMultiplier);

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

  const { roll, won, resultMultiplier } = evaluateLimboBet({
    serverSeed,
    betId,
    clientSeed,
    targetMultiplier: request.targetMultiplier,
    houseEdge: LIMBO_HOUSE_EDGE,
  });

  const payoutLamports = won
    ? Math.floor(request.amountLamports * request.targetMultiplier)
    : 0;

  if (payoutLamports > 0) {
    updateBalance(request.walletAddress, payoutLamports);
  }

  recordBetWithRewards({
    id: betId,
    walletAddress: request.walletAddress,
    game: "limbo",
    amountLamports: request.amountLamports,
    payoutLamports,
    multiplier: won ? request.targetMultiplier : 0,
    result: won ? "win" : "loss",
    metadata: {
      targetMultiplier: request.targetMultiplier,
      resultMultiplier,
      roll,
      serverSeedHash,
      serverSeed,
      clientSeed,
    },
  });

  return {
    betId,
    targetMultiplier: request.targetMultiplier,
    resultMultiplier,
    roll,
    won,
    payoutLamports,
    serverSeedHash,
    serverSeed,
    clientSeed,
  };
}

export function recordBetWithRewards(params: {
  id: string;
  walletAddress: string;
  game: string;
  amountLamports: number;
  payoutLamports: number;
  multiplier?: number;
  result?: string;
  metadata?: Record<string, unknown>;
}): void {
  recordBet(params);
  recordAffiliateCommission({
    betId: params.id,
    walletAddress: params.walletAddress,
    amountLamports: params.amountLamports,
    payoutLamports: params.payoutLamports,
  });
  accrueRakeback({
    walletAddress: params.walletAddress,
    amountLamports: params.amountLamports,
    payoutLamports: params.payoutLamports,
  });
  recordTournamentWager(params.walletAddress, params.amountLamports);
}

export { MIN_TARGET as LIMBO_MIN_TARGET, MAX_TARGET as LIMBO_MAX_TARGET };
