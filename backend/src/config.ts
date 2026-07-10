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
  casinoWalletAddress:
    process.env.CASINO_WALLET_ADDRESS ??
    "C9W7nGv2ZBJp4zcmtvBHkrtTPhB1FQ7JaNNPRNhiA4Ze",
  casinoWalletPrivateKey: process.env.CASINO_WALLET_PRIVATE_KEY ?? "",
  frontendUrl:
    process.env.FRONTEND_URL ??
    "http://localhost:5173",
  jwtSecret:
    process.env.JWT_SECRET ??
    "dev-only-change-in-production-" + "FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb",
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
  pumpProgramId:
    process.env.PUMP_PROGRAM_ID ??
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  publicApiUrl: process.env.PUBLIC_API_URL ?? "",
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
