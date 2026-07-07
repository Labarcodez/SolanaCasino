export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  casinoWalletAddress:
    process.env.CASINO_WALLET_ADDRESS ??
    "FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb",
  casinoWalletPrivateKey: process.env.CASINO_WALLET_PRIVATE_KEY ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  houseEdge: parseFloat(process.env.HOUSE_EDGE ?? "0.05"),
  minBetSol: parseFloat(process.env.MIN_BET_SOL ?? "0.001"),
  maxBetSol: parseFloat(process.env.MAX_BET_SOL ?? "10"),
  minWithdrawSol: parseFloat(process.env.MIN_WITHDRAW_SOL ?? "0.01"),
};

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}
