import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { db, updateBalance } from "../db/index.js";
import { config, lamportsToSol, solToLamports } from "../config.js";
import { creditPlayerOnChain, isAnchorEnabled } from "./anchor.js";

const COMMISSION_RATE = 0.3; // 30% of house edge to referrer

export function generateReferralCode(walletAddress: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(walletAddress)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `ORBIT${hash}`;
}

export function ensureReferralCode(walletAddress: string): string {
  const row = db
    .prepare("SELECT referral_code FROM users WHERE wallet_address = ?")
    .get(walletAddress) as { referral_code: string | null } | undefined;

  if (row?.referral_code) return row.referral_code;

  let code = generateReferralCode(walletAddress);
  let attempts = 0;
  while (attempts < 5) {
    try {
      db.prepare(
        "UPDATE users SET referral_code = ? WHERE wallet_address = ?",
      ).run(code, walletAddress);
      return code;
    } catch {
      code = `ORBIT${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      attempts++;
    }
  }
  throw new Error("Failed to generate referral code");
}

export function resolveReferrerWallet(referralCode: string): string | null {
  const row = db
    .prepare("SELECT wallet_address FROM users WHERE referral_code = ?")
    .get(referralCode.toUpperCase()) as { wallet_address: string } | undefined;
  return row?.wallet_address ?? null;
}

export function applyReferralOnSignup(
  walletAddress: string,
  referralCode?: string,
): void {
  if (!referralCode) return;

  const referrer = resolveReferrerWallet(referralCode);
  if (!referrer || referrer === walletAddress) return;

  const existing = db
    .prepare("SELECT referred_by FROM users WHERE wallet_address = ?")
    .get(walletAddress) as { referred_by: string | null } | undefined;

  if (existing?.referred_by) return;

  db.prepare(
    "UPDATE users SET referred_by = ? WHERE wallet_address = ? AND referred_by IS NULL",
  ).run(referrer, walletAddress);
}

export function recordAffiliateCommission(params: {
  betId: string;
  walletAddress: string;
  amountLamports: number;
  payoutLamports: number;
}): void {
  const user = db
    .prepare("SELECT referred_by FROM users WHERE wallet_address = ?")
    .get(params.walletAddress) as { referred_by: string | null } | undefined;

  if (!user?.referred_by) return;

  const houseEdgeLamports = Math.max(
    0,
    params.amountLamports - params.payoutLamports,
  );
  if (houseEdgeLamports === 0) return;

  const commissionLamports = Math.floor(houseEdgeLamports * COMMISSION_RATE);
  if (commissionLamports === 0) return;

  db.prepare(
    `INSERT INTO affiliate_earnings
     (id, referrer_wallet, referred_wallet, bet_id, house_edge_lamports, commission_lamports)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    uuidv4(),
    user.referred_by,
    params.walletAddress,
    params.betId,
    houseEdgeLamports,
    commissionLamports,
  );
}

export function getAffiliateStats(walletAddress: string): {
  referralCode: string;
  referralLink: string;
  referredCount: number;
  totalCommissionSol: number;
  pendingCommissionSol: number;
} {
  const code = ensureReferralCode(walletAddress);
  const referredCount = db
    .prepare("SELECT COUNT(*) as c FROM users WHERE referred_by = ?")
    .get(walletAddress) as { c: number };

  const earnings = db
    .prepare(
      `SELECT COALESCE(SUM(commission_lamports), 0) as total
       FROM affiliate_earnings WHERE referrer_wallet = ?`,
    )
    .get(walletAddress) as { total: number };

  const claimed = db
    .prepare(
      `SELECT COALESCE(SUM(amount_lamports), 0) as total
       FROM affiliate_claims WHERE wallet_address = ?`,
    )
    .get(walletAddress) as { total: number };

  const pendingLamports = Math.max(0, earnings.total - claimed.total);
  const baseUrl = config.frontendUrl.replace(/\/$/, "");

  return {
    referralCode: code,
    referralLink: `${baseUrl}/?ref=${code}`,
    referredCount: referredCount.c,
    totalCommissionSol: lamportsToSol(earnings.total),
    pendingCommissionSol: lamportsToSol(pendingLamports),
  };
}

export async function claimAffiliateCommission(walletAddress: string): Promise<{
  claimedSol: number;
  balanceSol: number | null;
  signature?: string;
  onChain?: boolean;
}> {
  const stats = getAffiliateStats(walletAddress);
  const pendingLamports = solToLamports(stats.pendingCommissionSol);

  if (pendingLamports < solToLamports(0.001)) {
    throw new Error("Minimum affiliate claim is 0.001 SOL");
  }

  if (isAnchorEnabled()) {
    const signature = await creditPlayerOnChain(walletAddress, pendingLamports);
    if (!signature) {
      throw new Error("On-chain affiliate credit failed");
    }

    db.prepare(
      `INSERT INTO affiliate_claims (id, wallet_address, amount_lamports)
       VALUES (?, ?, ?)`,
    ).run(uuidv4(), walletAddress, pendingLamports);

    return {
      claimedSol: lamportsToSol(pendingLamports),
      balanceSol: null,
      signature,
      onChain: true,
    };
  }

  db.prepare(
    `INSERT INTO affiliate_claims (id, wallet_address, amount_lamports)
     VALUES (?, ?, ?)`,
  ).run(uuidv4(), walletAddress, pendingLamports);

  const newBalance = updateBalance(walletAddress, pendingLamports);

  return {
    claimedSol: lamportsToSol(pendingLamports),
    balanceSol: lamportsToSol(newBalance),
  };
}
