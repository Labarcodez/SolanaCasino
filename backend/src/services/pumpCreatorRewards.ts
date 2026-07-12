/**
 * Pump.fun creator-fee claim + holder lottery.
 *
 * CRITICAL SAFETY: winner payouts use ONLY the net SOL gained from the claim
 * (treasury balance delta). Pre-existing treasury / deposit float is never used.
 */
import { createHash, randomInt } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { config, LAMPORTS_PER_SOL, lamportsToSol } from "../config.js";
import { db } from "../db/index.js";
import {
  connection,
  getCasinoWalletBalance,
  isWithdrawalEnabled,
  sendCasinoVersionedTransaction,
  sendWithdrawal,
} from "./solana.js";

const PUMP_COLLECT_API = "https://fun-block.pump.fun/agents/collect-fees";
const PUMP_COIN_API = "https://frontend-api.pump.fun/coins";

export interface TokenRewardRow {
  id: string;
  mint: string;
  winner_wallet: string;
  claimed_lamports: number;
  winner_lamports: number;
  treasury_lamports: number;
  claim_signature: string;
  payout_signature: string | null;
  holder_balance: string;
  created_at: string;
}

export interface HolderCandidate {
  wallet: string;
  amount: bigint;
}

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let nextRunAtMs = 0;
let lastRunAtMs = 0;
let lastSkipReason: string | null = null;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function envFloat(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getRewardLotteryConfig() {
  const mint = config.orbitTokenMint.trim();
  const live =
    config.orbitTokenLaunchStatus === "live" &&
    Boolean(mint) &&
    config.orbitTokenLaunchPlatform === "pump";
  const enabled =
    config.tokenRewardLotteryEnabled &&
    live;
  return {
    enabled,
    live,
    mint: live ? mint : null,
    intervalMs: envInt("TOKEN_REWARD_INTERVAL_MS", 5 * 60 * 1000),
    minClaimLamports: Math.floor(
      envFloat("TOKEN_REWARD_MIN_CLAIM_SOL", 0.002) * LAMPORTS_PER_SOL,
    ),
    /** Share of *claimed* SOL paid to the winner. Rest stays as newly claimed treasury. */
    winnerBps: Math.min(10_000, Math.max(0, envInt("TOKEN_REWARD_WINNER_BPS", 5000))),
  };
}

/** Pure helper — exported for unit tests. */
export function pickWeightedHolder(
  holders: HolderCandidate[],
  entropy?: Uint8Array,
): HolderCandidate | null {
  if (holders.length === 0) return null;
  let total = 0n;
  for (const h of holders) {
    if (h.amount > 0n) total += h.amount;
  }
  if (total <= 0n) return null;

  let ticket: bigint;
  if (entropy && entropy.length >= 8) {
    ticket = 0n;
    for (let i = 0; i < 8; i++) {
      ticket = (ticket << 8n) | BigInt(entropy[i]!);
    }
    ticket = ticket % total;
  } else {
    // randomInt is inclusive; map into [0, total)
    const maxSafe = total > BigInt(Number.MAX_SAFE_INTEGER)
      ? Number.MAX_SAFE_INTEGER
      : Number(total);
    ticket = BigInt(randomInt(0, maxSafe));
    if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
      // Fall back to hash mixing for very large totals
      const h = createHash("sha256")
        .update(Buffer.from(String(Date.now())))
        .update(Buffer.from(String(randomInt(0, 1_000_000_000))))
        .digest();
      let wide = 0n;
      for (let i = 0; i < 8; i++) wide = (wide << 8n) | BigInt(h[i]!);
      ticket = wide % total;
    }
  }

  let cursor = 0n;
  for (const h of holders) {
    if (h.amount <= 0n) continue;
    cursor += h.amount;
    if (ticket < cursor) return h;
  }
  return holders[holders.length - 1] ?? null;
}

/**
 * Winner payout must never exceed half (or winnerBps) of the *claim delta*.
 * Returns null if the claim did not increase treasury SOL.
 */
export function computeClaimOnlyPayout(
  balanceBeforeLamports: number,
  balanceAfterLamports: number,
  winnerBps: number,
): { claimedLamports: number; winnerLamports: number; treasuryKeepLamports: number } | null {
  const claimedLamports = balanceAfterLamports - balanceBeforeLamports;
  if (claimedLamports <= 0) return null;
  const winnerLamports = Math.floor((claimedLamports * winnerBps) / 10_000);
  if (winnerLamports <= 0 || winnerLamports > claimedLamports) return null;
  return {
    claimedLamports,
    winnerLamports,
    treasuryKeepLamports: claimedLamports - winnerLamports,
  };
}

async function fetchPumpCoin(mint: string): Promise<{
  creator?: string;
  bonding_curve?: string;
  associated_bonding_curve?: string;
} | null> {
  try {
    const res = await fetch(`${PUMP_COIN_API}/${mint}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      creator?: string;
      bonding_curve?: string;
      associated_bonding_curve?: string;
    };
  } catch {
    return null;
  }
}

async function buildCollectFeeTransaction(
  mint: string,
  user: string,
): Promise<{ transaction: string; creator: string }> {
  const res = await fetch(PUMP_COLLECT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mint,
      user,
      encoding: "base64",
      frontRunningProtection: false,
      tipAmount: 0,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pump collect-fees API failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    transaction?: string;
    creator?: string;
    error?: string;
  };
  if (!data.transaction) {
    throw new Error(data.error ?? "Pump collect-fees returned no transaction");
  }
  return {
    transaction: data.transaction,
    creator: data.creator ?? user,
  };
}

async function loadEligibleHolders(
  mint: string,
  exclude: Set<string>,
): Promise<HolderCandidate[]> {
  const mintPk = new PublicKey(mint);
  const largest = await connection.getTokenLargestAccounts(mintPk);
  const candidates: HolderCandidate[] = [];

  for (const row of largest.value) {
    if (row.uiAmount === 0 || !row.amount || row.amount === "0") continue;
    try {
      const info = await connection.getParsedAccountInfo(row.address);
      const parsed = info.value?.data;
      if (!parsed || typeof parsed === "string" || !("parsed" in parsed)) continue;
      const owner = (parsed.parsed as { info?: { owner?: string } })?.info?.owner;
      if (!owner || exclude.has(owner)) continue;
      const amount = BigInt(row.amount);
      if (amount <= 0n) continue;
      candidates.push({ wallet: owner, amount });
    } catch {
      /* skip unreadable account */
    }
  }

  // Merge duplicate owners (multiple ATAs)
  const byWallet = new Map<string, bigint>();
  for (const c of candidates) {
    byWallet.set(c.wallet, (byWallet.get(c.wallet) ?? 0n) + c.amount);
  }
  return [...byWallet.entries()].map(([wallet, amount]) => ({ wallet, amount }));
}

function insertRewardRow(row: {
  id: string;
  mint: string;
  winnerWallet: string;
  claimedLamports: number;
  winnerLamports: number;
  treasuryLamports: number;
  claimSignature: string;
  payoutSignature: string | null;
  holderBalance: string;
}): void {
  db.prepare(
    `INSERT INTO token_reward_distributions
      (id, mint, winner_wallet, claimed_lamports, winner_lamports, treasury_lamports,
       claim_signature, payout_signature, holder_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.mint,
    row.winnerWallet,
    row.claimedLamports,
    row.winnerLamports,
    row.treasuryLamports,
    row.claimSignature,
    row.payoutSignature,
    row.holderBalance,
  );
}

export function listRecentTokenRewards(limit = 20): TokenRewardRow[] {
  return db
    .prepare(
      `SELECT * FROM token_reward_distributions
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as TokenRewardRow[];
}

export function getTokenRewardLotteryStatus() {
  const cfg = getRewardLotteryConfig();
  const recent = listRecentTokenRewards(10);
  return {
    enabled: cfg.enabled,
    live: cfg.live,
    mint: cfg.mint,
    intervalMs: cfg.intervalMs,
    minClaimSol: cfg.minClaimLamports / LAMPORTS_PER_SOL,
    winnerBps: cfg.winnerBps,
    winnerPercent: cfg.winnerBps / 100,
    nextRunAt: nextRunAtMs ? new Date(nextRunAtMs).toISOString() : null,
    lastRunAt: lastRunAtMs ? new Date(lastRunAtMs).toISOString() : null,
    lastSkipReason,
    recent: recent.map((r) => ({
      id: r.id,
      winnerWallet: r.winner_wallet,
      claimedSol: lamportsToSol(r.claimed_lamports),
      winnerSol: lamportsToSol(r.winner_lamports),
      treasuryKeepSol: lamportsToSol(r.treasury_lamports),
      claimSignature: r.claim_signature,
      payoutSignature: r.payout_signature,
      createdAt: r.created_at,
    })),
  };
}

export async function runTokenRewardLotteryCycle(): Promise<{
  status: "ok" | "skipped" | "error";
  reason?: string;
}> {
  if (running) {
    return { status: "skipped", reason: "already_running" };
  }

  const cfg = getRewardLotteryConfig();
  lastRunAtMs = Date.now();
  nextRunAtMs = lastRunAtMs + cfg.intervalMs;

  if (!cfg.enabled || !cfg.mint) {
    lastSkipReason = "lottery_disabled_or_token_not_live";
    return { status: "skipped", reason: lastSkipReason };
  }
  if (!isWithdrawalEnabled()) {
    lastSkipReason = "casino_wallet_not_configured";
    return { status: "skipped", reason: lastSkipReason };
  }

  running = true;
  try {
    const mint = cfg.mint;
    const treasury = config.casinoWalletAddress;

    const coin = await fetchPumpCoin(mint);
    const exclude = new Set<string>([
      treasury,
      ...(coin?.creator ? [coin.creator] : []),
      ...(coin?.bonding_curve ? [coin.bonding_curve] : []),
      ...(coin?.associated_bonding_curve ? [coin.associated_bonding_curve] : []),
    ]);

    // Snapshot treasury BEFORE claim — payout is capped to the delta only.
    const balanceBefore = await getCasinoWalletBalance();

    const collect = await buildCollectFeeTransaction(mint, treasury);
    if (collect.creator && collect.creator !== treasury) {
      lastSkipReason = `creator_mismatch:${collect.creator}`;
      console.warn(
        `[token-rewards] Pump creator ${collect.creator} != treasury ${treasury} — refusing claim`,
      );
      return { status: "skipped", reason: lastSkipReason };
    }

    const { signature: claimSignature } = await sendCasinoVersionedTransaction(
      collect.transaction,
    );

    // Allow balance to settle
    await new Promise((r) => setTimeout(r, 1500));
    const balanceAfter = await getCasinoWalletBalance();

    const split = computeClaimOnlyPayout(
      balanceBefore,
      balanceAfter,
      cfg.winnerBps,
    );

    if (!split || split.claimedLamports < cfg.minClaimLamports) {
      lastSkipReason = split
        ? `claim_below_min:${lamportsToSol(split.claimedLamports)}`
        : "claim_did_not_increase_treasury";
      console.log(
        `[token-rewards] Claim tx ${claimSignature} but no lottery payout (${lastSkipReason})`,
      );
      // Still record claim-only row with zero winner if we got a positive tiny claim
      if (split && split.claimedLamports > 0) {
        insertRewardRow({
          id: uuidv4(),
          mint,
          winnerWallet: "",
          claimedLamports: split.claimedLamports,
          winnerLamports: 0,
          treasuryLamports: split.claimedLamports,
          claimSignature,
          payoutSignature: null,
          holderBalance: "0",
        });
      }
      return { status: "skipped", reason: lastSkipReason };
    }

    const holders = await loadEligibleHolders(mint, exclude);
    const winner = pickWeightedHolder(holders);
    if (!winner) {
      lastSkipReason = "no_eligible_holders";
      console.warn("[token-rewards] Claimed fees but no eligible holders for lottery");
      insertRewardRow({
        id: uuidv4(),
        mint,
        winnerWallet: "",
        claimedLamports: split.claimedLamports,
        winnerLamports: 0,
        treasuryLamports: split.claimedLamports,
        claimSignature,
        payoutSignature: null,
        holderBalance: "0",
      });
      return { status: "skipped", reason: lastSkipReason };
    }

    // Final safety: never pay more than the claim delta share
    if (split.winnerLamports > split.claimedLamports) {
      throw new Error("Safety abort: winner payout exceeds claim delta");
    }

    const { signature: payoutSignature } = await sendWithdrawal(
      winner.wallet,
      split.winnerLamports,
    );

    insertRewardRow({
      id: uuidv4(),
      mint,
      winnerWallet: winner.wallet,
      claimedLamports: split.claimedLamports,
      winnerLamports: split.winnerLamports,
      treasuryLamports: split.treasuryKeepLamports,
      claimSignature,
      payoutSignature,
      holderBalance: winner.amount.toString(),
    });

    lastSkipReason = null;
    console.log(
      `[token-rewards] Claimed ${lamportsToSol(split.claimedLamports)} SOL; ` +
        `paid ${lamportsToSol(split.winnerLamports)} SOL to ${winner.wallet} ` +
        `(claim ${claimSignature}, payout ${payoutSignature})`,
    );
    return { status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastSkipReason = `error:${msg.slice(0, 160)}`;
    console.error("[token-rewards] cycle failed:", msg);
    return { status: "error", reason: lastSkipReason };
  } finally {
    running = false;
  }
}

export function startPumpCreatorRewardLottery(): void {
  const cfg = getRewardLotteryConfig();
  if (timer) return;

  nextRunAtMs = Date.now() + 30_000;
  console.log(
    cfg.enabled
      ? `[token-rewards] Lottery armed every ${cfg.intervalMs / 1000}s (50% of claimed fees → weighted random holder; treasury float untouched)`
      : `[token-rewards] Lottery idle until Pump token is live (ORBIT_TOKEN_MINT + STATUS=live)`,
  );

  // First attempt shortly after boot, then on interval
  setTimeout(() => {
    void runTokenRewardLotteryCycle();
  }, 30_000).unref();

  timer = setInterval(() => {
    void runTokenRewardLotteryCycle();
  }, cfg.intervalMs);
  timer.unref();
}

export function stopPumpCreatorRewardLottery(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
