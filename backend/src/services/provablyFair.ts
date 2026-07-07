import crypto from "node:crypto";

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
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
