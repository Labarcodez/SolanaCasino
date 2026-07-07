import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

/** SHA-256 of raw 32-byte seed — matches on-chain `finalize_round` commitment. */
export function hashServerSeedBytes(serverSeedHex: string): string {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(serverSeedHex, "hex"))
    .digest("hex");
}

/** On-chain crash point (no client seeds, numeric round id). */
export function generateOnChainCrashPoint(
  serverSeedHex: string,
  roundId: number,
): number {
  const combined = `${serverSeedHex}:${roundId}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  if (h % 33 === 0) return 1.0;
  const result = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1.0, Math.min(result, 1000000));
}

/** On-chain coinflip: sha256(serverSeed ‖ owner ‖ clientSeed) */
export function generateOnChainCoinflipResult(
  serverSeedHex: string,
  ownerBase58: string,
  clientSeedHex: string,
): "heads" | "tails" {
  const ownerBytes = Buffer.from(ownerBase58);
  const seedBytes = Buffer.from(serverSeedHex, "hex");
  const clientBytes = Buffer.from(clientSeedHex, "hex");
  const combined = Buffer.concat([seedBytes, ownerBytes, clientBytes]);
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  return parseInt(hash.slice(0, 2), 16) % 2 === 0 ? "heads" : "tails";
}

/**
 * Provably fair crash point generation (95% RTP / 5% house edge).
 * Uses server seed + round id + client seeds combined.
 */
export function generateCrashPoint(
  serverSeed: string,
  roundId: string,
  clientSeeds: string[] = [],
): number {
  const combined = [serverSeed, roundId, ...clientSeeds.sort()].join(":");
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);

  if (h % 33 === 0) {
    return 1.0;
  }

  const result = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1.0, Math.min(result, 1000000));
}

export function generateCoinflipResult(
  serverSeed: string,
  betId: string,
  clientSeed: string,
): "heads" | "tails" {
  const combined = `${serverSeed}:${betId}:${clientSeed}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  const value = parseInt(hash.slice(0, 8), 16);
  return value % 2 === 0 ? "heads" : "tails";
}

export function verifyCrashPoint(
  serverSeed: string,
  serverSeedHash: string,
  roundId: string,
  clientSeeds: string[],
  crashPoint: number,
): boolean {
  if (hashServerSeed(serverSeed) !== serverSeedHash) return false;
  return generateCrashPoint(serverSeed, roundId, clientSeeds) === crashPoint;
}

/** Limbo: roll 0–9999, win if roll < winChanceBps. 2% house edge on limbo (98% RTP). */
export const LIMBO_HOUSE_EDGE = 0.02;

export function generateLimboRoll(
  serverSeed: string,
  betId: string,
  clientSeed: string,
): number {
  const combined = `${serverSeed}:${betId}:${clientSeed}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  return parseInt(hash.slice(0, 4), 16) % 10000;
}

export function getLimboWinChanceBps(
  targetMultiplier: number,
  houseEdge = LIMBO_HOUSE_EDGE,
): number {
  const edgeBps = Math.floor(houseEdge * 10000);
  const targetMilli = Math.floor(targetMultiplier * 1000);
  return Math.floor(((10000 - edgeBps) * 1000) / targetMilli);
}

export function evaluateLimboBet(params: {
  serverSeed: string;
  betId: string;
  clientSeed: string;
  targetMultiplier: number;
  houseEdge?: number;
}): { roll: number; won: boolean; resultMultiplier: number } {
  const roll = generateLimboRoll(
    params.serverSeed,
    params.betId,
    params.clientSeed,
  );
  const winChanceBps = getLimboWinChanceBps(
    params.targetMultiplier,
    params.houseEdge ?? LIMBO_HOUSE_EDGE,
  );
  const won = roll < winChanceBps;
  const resultMultiplier = won ? params.targetMultiplier : 0;
  return { roll, won, resultMultiplier };
}

/** On-chain limbo roll: sha256(serverSeed ‖ ownerPubkey ‖ clientSeed) mod 10000 */
export function generateOnChainLimboRoll(
  serverSeedHex: string,
  walletAddress: string,
  clientSeedHex: string,
): number {
  const seedBytes = Buffer.from(serverSeedHex, "hex");
  const ownerBytes = new PublicKey(walletAddress).toBuffer();
  const clientBytes = Buffer.from(
    clientSeedHex.padEnd(32, "0").slice(0, 32),
    "hex",
  );
  const combined = Buffer.concat([
    seedBytes,
    ownerBytes,
    clientBytes.slice(0, 16),
  ]);
  const hash = crypto.createHash("sha256").update(combined).digest();
  const val = hash[0]! << 8 | hash[1]!;
  return val % 10000;
}

export function evaluateOnChainLimboBet(params: {
  serverSeedHex: string;
  walletAddress: string;
  clientSeedHex: string;
  targetMultiplier: number;
  houseEdgeBps?: number;
}): { roll: number; won: boolean } {
  const roll = generateOnChainLimboRoll(
    params.serverSeedHex,
    params.walletAddress,
    params.clientSeedHex,
  );
  const edgeBps = params.houseEdgeBps ?? 200;
  const targetMilli = Math.floor(params.targetMultiplier * 1000);
  const winChanceBps = Math.floor(((10000 - edgeBps) * 1000) / targetMilli);
  const won = roll < winChanceBps;
  return { roll, won };
}

export function verifyLimboBet(params: {
  serverSeed: string;
  betId: string;
  clientSeed: string;
  targetMultiplier: number;
  expectedWon: boolean;
  houseEdge?: number;
}): boolean {
  const { won } = evaluateLimboBet(params);
  return won === params.expectedWon;
}
