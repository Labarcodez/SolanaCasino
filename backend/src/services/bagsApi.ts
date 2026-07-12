import { config, lamportsToSol } from "../config.js";

/** @see https://docs.bags.fm/principles/base-url-versioning */
export const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";
export const BAGS_PING_URL = "https://public-api-v2.bags.fm/ping";

interface BagsSuccessEnvelope<T> {
  success: true;
  response: T;
}

interface BagsErrorEnvelope {
  success: false;
  error?: string;
  response?: string;
}

type BagsEnvelope<T> = BagsSuccessEnvelope<T> | BagsErrorEnvelope;

export interface BagsCreatorProfile {
  username: string;
  displayName: string;
  picture: string | null;
  ticker: string | null;
  profileUrl: string;
}

export interface BagsTokenCreator {
  wallet: string;
  isCreator: boolean;
  royaltyBps: number;
  provider: string | null;
  providerUsername: string | null;
  bagsUsername: string | null;
}

export interface BagsTokenLiveStats {
  pool: {
    tokenMint: string;
    dbcPoolKey: string;
    dammV2PoolKey: string | null;
    migrated: boolean;
  } | null;
  lifetimeFeesSol: number | null;
  creators: BagsTokenCreator[];
}

const PROFILE_CACHE_MS = 5 * 60 * 1000;
let cachedProfile: BagsCreatorProfile | null | undefined;
let profileCachedAt = 0;

export function isBagsApiConfigured(): boolean {
  return getBagsApiKey().length > 0;
}

function getBagsApiKey(): string {
  return (process.env.BAGS_FM_API_KEY ?? config.bagsFmApiKey).trim();
}

async function parseBagsJson<T>(res: Response): Promise<T | null> {
  try {
    const body = (await res.json()) as BagsEnvelope<T>;
    if (!res.ok || !body.success || !("response" in body)) {
      return null;
    }
    return body.response;
  } catch {
    return null;
  }
}

async function bagsApiGet<T>(
  path: string,
  query?: Record<string, string>,
): Promise<T | null> {
  if (!isBagsApiConfigured()) {
    return null;
  }

  const base = BAGS_API_BASE.endsWith("/") ? BAGS_API_BASE : `${BAGS_API_BASE}/`;
  const url = new URL(path.replace(/^\//, ""), base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": getBagsApiKey() },
      signal: AbortSignal.timeout(12_000),
    });
    return parseBagsJson<T>(res);
  } catch {
    return null;
  }
}

export async function pingBagsApi(): Promise<boolean> {
  try {
    const res = await fetch(BAGS_PING_URL, { signal: AbortSignal.timeout(5_000) });
    const body = (await res.json()) as { message?: string };
    return res.ok && body.message === "pong";
  } catch {
    return false;
  }
}

/** Validates the server-side API key via GET /auth/me. */
export async function verifyBagsApiKey(): Promise<boolean> {
  const me = await bagsApiGet<{ user: { username: string } }>("/auth/me");
  return Boolean(me?.user?.username);
}

function mapCreatorProfile(
  user: {
    username: string;
    pref_name?: string;
    picture?: string;
    ticker?: string;
  },
): BagsCreatorProfile {
  return {
    username: user.username,
    displayName: user.pref_name || user.username,
    picture: user.picture ?? null,
    ticker: user.ticker ?? null,
    profileUrl: `https://bags.fm/@${user.username}`,
  };
}

/** Cached Bags creator profile for the API key owner (your @orbitsolanacasino account). */
export async function getBagsCreatorProfile(): Promise<BagsCreatorProfile | null> {
  if (!isBagsApiConfigured()) {
    return null;
  }

  const now = Date.now();
  if (cachedProfile !== undefined && now - profileCachedAt < PROFILE_CACHE_MS) {
    return cachedProfile;
  }

  const me = await bagsApiGet<{
    user: {
      username: string;
      pref_name?: string;
      picture?: string;
      ticker?: string;
    };
  }>("/auth/me");

  cachedProfile = me?.user ? mapCreatorProfile(me.user) : null;
  profileCachedAt = now;
  return cachedProfile;
}

export async function getBagsTokenLiveStats(
  tokenMint: string,
): Promise<BagsTokenLiveStats> {
  const [pool, lifetimeFeesLamports, creators] = await Promise.all([
    bagsApiGet<{
      tokenMint: string;
      dbcPoolKey: string;
      dammV2PoolKey: string | null;
    }>("/solana/bags/pools/token-mint", { tokenMint }),
    bagsApiGet<string>("/token-launch/lifetime-fees", { tokenMint }),
    bagsApiGet<
      Array<{
        wallet: string;
        isCreator: boolean;
        royaltyBps: number;
        provider?: string | null;
        providerUsername?: string | null;
        bagsUsername?: string | null;
      }>
    >("/token-launch/creator/v3", { tokenMint }),
  ]);

  let lifetimeFeesSol: number | null = null;
  if (lifetimeFeesLamports) {
    const lamports = Number(lifetimeFeesLamports);
    if (Number.isFinite(lamports) && lamports >= 0) {
      lifetimeFeesSol = lamportsToSol(lamports);
    }
  }

  return {
    pool: pool
      ? {
          tokenMint: pool.tokenMint,
          dbcPoolKey: pool.dbcPoolKey,
          dammV2PoolKey: pool.dammV2PoolKey,
          migrated: Boolean(pool.dammV2PoolKey),
        }
      : null,
    lifetimeFeesSol,
    creators: (creators ?? []).map((c) => ({
      wallet: c.wallet,
      isCreator: c.isCreator,
      royaltyBps: c.royaltyBps,
      provider: c.provider ?? null,
      providerUsername: c.providerUsername ?? null,
      bagsUsername: c.bagsUsername ?? null,
    })),
  };
}

/** @internal Test helper */
export function resetBagsProfileCacheForTests(): void {
  cachedProfile = undefined;
  profileCachedAt = 0;
}
