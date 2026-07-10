export function fairnessUrl(params: {
  game: "crash" | "limbo" | "coinflip";
  roundId?: string;
  betId?: string;
  serverSeed?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  crashPoint?: number;
  targetMultiplier?: number;
}): string {
  const q = new URLSearchParams({ verify: params.game });
  if (params.roundId) q.set("roundId", params.roundId);
  if (params.betId) q.set("betId", params.betId);
  if (params.serverSeed) q.set("serverSeed", params.serverSeed);
  if (params.serverSeedHash) q.set("serverSeedHash", params.serverSeedHash);
  if (params.clientSeed) q.set("clientSeed", params.clientSeed);
  if (params.crashPoint !== undefined) q.set("crashPoint", String(params.crashPoint));
  if (params.targetMultiplier !== undefined) {
    q.set("target", String(params.targetMultiplier));
  }
  return `/fairness?${q.toString()}`;
}
