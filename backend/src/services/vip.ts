import { v4 as uuidv4 } from "uuid";
import { db, updateBalance } from "../db/index.js";
import { lamportsToSol, solToLamports } from "../config.js";

export type VipTier = "none" | "bronze" | "silver" | "gold" | "orbit";

const VIP_TIERS: Array<{
  tier: VipTier;
  minWageredSol: number;
  rakebackPercent: number;
  label: string;
}> = [
  { tier: "none", minWageredSol: 0, rakebackPercent: 0, label: "Player" },
  { tier: "bronze", minWageredSol: 1, rakebackPercent: 5, label: "Bronze" },
  { tier: "silver", minWageredSol: 10, rakebackPercent: 8, label: "Silver" },
  { tier: "gold", minWageredSol: 100, rakebackPercent: 12, label: "Gold" },
  { tier: "orbit", minWageredSol: 1000, rakebackPercent: 15, label: "Orbit" },
];

export function getWageredLast30DaysLamports(walletAddress: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_lamports), 0) as total
       FROM bets
       WHERE wallet_address = ?
         AND created_at >= datetime('now', '-30 days')`,
    )
    .get(walletAddress) as { total: number };
  return row.total;
}

export function getVipTier(walletAddress: string): {
  tier: VipTier;
  label: string;
  rakebackPercent: number;
  wagered30dSol: number;
  nextTier: VipTier | null;
  nextTierWagerSol: number | null;
} {
  const wageredLamports = getWageredLast30DaysLamports(walletAddress);
  const wageredSol = lamportsToSol(wageredLamports);

  let current = VIP_TIERS[0];
  for (const t of VIP_TIERS) {
    if (wageredSol >= t.minWageredSol) current = t;
  }

  const currentIdx = VIP_TIERS.findIndex((t) => t.tier === current.tier);
  const next = VIP_TIERS[currentIdx + 1];

  return {
    tier: current.tier,
    label: current.label,
    rakebackPercent: current.rakebackPercent,
    wagered30dSol: wageredSol,
    nextTier: next?.tier ?? null,
    nextTierWagerSol: next?.minWageredSol ?? null,
  };
}

export function accrueRakeback(params: {
  walletAddress: string;
  amountLamports: number;
  payoutLamports: number;
}): void {
  const vip = getVipTier(params.walletAddress);
  if (vip.rakebackPercent === 0) return;

  const houseEdgeLamports = Math.max(
    0,
    params.amountLamports - params.payoutLamports,
  );
  if (houseEdgeLamports === 0) return;

  const rakebackLamports = Math.floor(
    houseEdgeLamports * (vip.rakebackPercent / 100),
  );
  if (rakebackLamports === 0) return;

  db.prepare(
    `UPDATE users SET rakeback_pending_lamports = rakeback_pending_lamports + ?
     WHERE wallet_address = ?`,
  ).run(rakebackLamports, params.walletAddress);
}

export function getPendingRakebackLamports(walletAddress: string): number {
  const row = db
    .prepare(
      "SELECT rakeback_pending_lamports FROM users WHERE wallet_address = ?",
    )
    .get(walletAddress) as { rakeback_pending_lamports: number } | undefined;
  return row?.rakeback_pending_lamports ?? 0;
}

export function claimRakeback(walletAddress: string): {
  claimedSol: number;
  balanceSol: number;
} {
  const pending = getPendingRakebackLamports(walletAddress);
  if (pending < solToLamports(0.001)) {
    throw new Error("Minimum rakeback claim is 0.001 SOL");
  }

  const vip = getVipTier(walletAddress);

  db.prepare(
    "UPDATE users SET rakeback_pending_lamports = 0 WHERE wallet_address = ?",
  ).run(walletAddress);

  const newBalance = updateBalance(walletAddress, pending);

  db.prepare(
    `INSERT INTO rakeback_claims (id, wallet_address, amount_lamports, vip_tier)
     VALUES (?, ?, ?, ?)`,
  ).run(uuidv4(), walletAddress, pending, vip.tier);

  return {
    claimedSol: lamportsToSol(pending),
    balanceSol: lamportsToSol(newBalance),
  };
}

export { VIP_TIERS };
