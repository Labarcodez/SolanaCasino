const solanaCluster = process.env.SOLANA_CLUSTER ?? "devnet";

function alchemyRpcUrl(cluster: string, apiKey: string): string {
  const network =
    cluster === "mainnet-beta" || cluster === "mainnet" ? "mainnet" : "devnet";
  return `https://solana-${network}.g.alchemy.com/v2/${apiKey}`;
}

function defaultPublicRpc(cluster: string): string {
  return cluster === "mainnet-beta" || cluster === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

function resolveSolanaRpcUrl(cluster: string): string {
  if (process.env.SOLANA_RPC_URL) return process.env.SOLANA_RPC_URL;
  if (process.env.HELIUS_RPC_URL) return process.env.HELIUS_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) {
    return alchemyRpcUrl(cluster, process.env.ALCHEMY_API_KEY);
  }
  return defaultPublicRpc(cluster);
}

function resolveSolanaRpcFallback(cluster: string): string {
  if (process.env.SOLANA_RPC_FALLBACK) return process.env.SOLANA_RPC_FALLBACK;
  return defaultPublicRpc(cluster);
}

/** Browser-safe RPC — avoid providers that block mainnet on free tier (e.g. dRPC). */
function resolveClientRpcUrl(cluster: string): string {
  if (process.env.CLIENT_RPC_URL) return process.env.CLIENT_RPC_URL;
  return defaultPublicRpc(cluster);
}

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  solanaRpcUrl: resolveSolanaRpcUrl(solanaCluster),
  solanaRpcFallback: resolveSolanaRpcFallback(solanaCluster),
  clientRpcUrl: resolveClientRpcUrl(solanaCluster),
  solanaCluster,
  programId:
    process.env.PROGRAM_ID ??
    "Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU",
  programAuthorityPrivateKey: process.env.PROGRAM_AUTHORITY_PRIVATE_KEY ?? "",
  /** Canonical hot-wallet pubkey — keep in sync with CFN / Vite / docker defaults. */
  casinoWalletAddress:
    process.env.CASINO_WALLET_ADDRESS ??
    "3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu",
  casinoWalletPrivateKey: process.env.CASINO_WALLET_PRIVATE_KEY ?? "",
  /**
   * When true, new bets are rejected if hot wallet SOL < player liabilities.
   * Default on in production; set BLOCK_BETS_WHEN_INSOLVENT=false to disable.
   */
  blockBetsWhenInsolvent:
    process.env.BLOCK_BETS_WHEN_INSOLVENT === undefined ||
    process.env.BLOCK_BETS_WHEN_INSOLVENT === ""
      ? (process.env.NODE_ENV ?? "development") === "production"
      : process.env.BLOCK_BETS_WHEN_INSOLVENT === "1" ||
        process.env.BLOCK_BETS_WHEN_INSOLVENT.toLowerCase() === "true",
  /** Pending withdrawal confirmation sweeper interval (ms). */
  withdrawFinalizeIntervalMs: Math.max(
    15_000,
    parseInt(process.env.WITHDRAW_FINALIZE_INTERVAL_MS ?? "45000", 10) || 45_000,
  ),
  sentryDsn: process.env.SENTRY_DSN ?? "",
  frontendUrl:
    process.env.FRONTEND_URL ??
    "http://localhost:5173",
  jwtSecret:
    process.env.JWT_SECRET ??
    "dev-only-change-in-production-do-not-use-in-prod",
  houseEdge: parseFloat(process.env.HOUSE_EDGE ?? "0.05"),
  minBetSol: parseFloat(process.env.MIN_BET_SOL ?? "0.001"),
  maxBetSol: parseFloat(process.env.MAX_BET_SOL ?? "10"),
  minWithdrawSol: parseFloat(process.env.MIN_WITHDRAW_SOL ?? "0.01"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  serveFrontend: process.env.SERVE_FRONTEND === "true",
  adminWallet: process.env.ADMIN_WALLET ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  orbitTokenMint: process.env.ORBIT_TOKEN_MINT ?? "",
  /** Comma-separated mints that must never be promoted as the site token (e.g. sniped relaunch). */
  orbitTokenDeprecatedMints: (process.env.ORBIT_TOKEN_DEPRECATED_MINTS ??
    "F2Kg2sH7q8CbH14ouZySE41vtwoJTbiuYCWeppR7BAGS,4T4seM2KAyQ23yF6aqnQHWiuGkuAp22FSs4fNbGPBAGS")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  /** Primary launch platform: pump (default) or bags. */
  orbitTokenLaunchPlatform:
    process.env.ORBIT_TOKEN_LAUNCH_PLATFORM === "bags" ? "bags" : "pump",
  /** Override launch status: coming_soon | live. Empty = auto from mint + URL. */
  orbitTokenLaunchStatus:
    process.env.ORBIT_TOKEN_LAUNCH_STATUS === "live"
      ? "live"
      : process.env.ORBIT_TOKEN_LAUNCH_STATUS === "coming_soon"
        ? "coming_soon"
        : "",
  /** Full Bags.fm coin URL after launch, e.g. https://bags.fm/{mint} */
  bagsFmTokenUrl: process.env.BAGS_FM_TOKEN_URL ?? "",
  /** Creator profile on Bags.fm (pre-launch landing). */
  bagsFmProfileUrl:
    process.env.BAGS_FM_PROFILE_URL ?? "https://bags.fm/@orbitsolanacasino",
  /** Server-side Bags API key — never expose to the browser. */
  bagsFmApiKey: process.env.BAGS_FM_API_KEY ?? "",
  pumpProgramId:
    process.env.PUMP_PROGRAM_ID ??
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  publicApiUrl: process.env.PUBLIC_API_URL ?? "",
  /**
   * Pump creator-fee lottery: every N ms claim fees, pay winnerBps of the
   * *claim delta only* to a weighted random holder (never treasury float).
   */
  tokenRewardLotteryEnabled:
    process.env.TOKEN_REWARD_LOTTERY_ENABLED === undefined ||
    process.env.TOKEN_REWARD_LOTTERY_ENABLED === ""
      ? true
      : process.env.TOKEN_REWARD_LOTTERY_ENABLED === "1" ||
        process.env.TOKEN_REWARD_LOTTERY_ENABLED.toLowerCase() === "true",
};

if (
  config.nodeEnv === "production" &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET.startsWith("dev-only-change-in-production"))
) {
  throw new Error("JWT_SECRET must be set to a strong value in production");
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export type RpcProvider = "alchemy" | "helius" | "custom" | "public";

export function getRpcProvider(): RpcProvider {
  if (process.env.SOLANA_RPC_URL) return "custom";
  if (process.env.HELIUS_RPC_URL) return "helius";
  if (process.env.ALCHEMY_API_KEY) return "alchemy";
  return "public";
}

export function isAlchemyRpcConfigured(): boolean {
  return getRpcProvider() === "alchemy";
}

export function maskRpcUrl(url: string): string {
  return url.replace(/\/v2\/[^/?]+/, "/v2/***");
}

export function getPublicRpcSetup() {
  return {
    provider: getRpcProvider(),
    alchemyConfigured: isAlchemyRpcConfigured(),
    cluster: config.solanaCluster,
    solanaRpcUrl: maskRpcUrl(config.solanaRpcUrl),
  };
}
