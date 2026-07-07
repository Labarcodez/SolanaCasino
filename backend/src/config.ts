export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL ??
    process.env.HELIUS_RPC_URL ??
    "https://api.devnet.solana.com",
  solanaRpcFallback:
    process.env.SOLANA_RPC_FALLBACK ?? "https://api.mainnet-beta.solana.com",
  solanaCluster: process.env.SOLANA_CLUSTER ?? "devnet",
  programId:
    process.env.PROGRAM_ID ??
    "Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU",
  programAuthorityPrivateKey: process.env.PROGRAM_AUTHORITY_PRIVATE_KEY ?? "",
  casinoWalletAddress:
    process.env.CASINO_WALLET_ADDRESS ??
    "FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb",
  casinoWalletPrivateKey: process.env.CASINO_WALLET_PRIVATE_KEY ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
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
