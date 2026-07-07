export const CASINO_WALLET =
  import.meta.env.VITE_CASINO_WALLET ??
  "FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb";

export const API_URL = import.meta.env.VITE_API_URL ?? "";
export const PHANTOM_APP_ID = import.meta.env.VITE_PHANTOM_APP_ID ?? "";
export const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export interface CasinoConfig {
  casinoWallet: string;
  minBetSol: number;
  maxBetSol: number;
  minWithdrawSol: number;
  houseEdge: number;
  withdrawalsEnabled: boolean;
}

export interface UserProfile {
  walletAddress: string;
  balanceSol: number;
  balanceLamports: number;
  onChainBalanceSol: number;
  totalWageredSol: number;
  totalWonSol: number;
}

export async function fetchConfig(): Promise<CasinoConfig> {
  const res = await fetch(`${API_URL}/api/config`);
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export async function fetchUser(walletAddress: string): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/api/user/${walletAddress}`);
  if (!res.ok) throw new Error("Failed to load user");
  return res.json();
}

export async function verifyDeposit(
  signature: string,
  walletAddress: string,
): Promise<{ success: boolean; amountSol: number; balanceSol: number }> {
  const res = await fetch(`${API_URL}/api/deposit/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature, walletAddress }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Deposit failed");
  return data;
}

export async function withdraw(
  walletAddress: string,
  amountSol: number,
): Promise<{ signature: string; balanceSol: number }> {
  const res = await fetch(`${API_URL}/api/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, amountSol }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
  return data;
}

export interface CoinflipResult {
  betId: string;
  choice: "heads" | "tails";
  result: "heads" | "tails";
  won: boolean;
  payoutSol: number;
  balanceSol: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
}

export async function playCoinflip(
  walletAddress: string,
  amountSol: number,
  choice: "heads" | "tails",
  clientSeed?: string,
): Promise<CoinflipResult> {
  const res = await fetch(`${API_URL}/api/coinflip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, amountSol, choice, clientSeed }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Coinflip failed");
  return data;
}

export interface BetHistory {
  id: string;
  game: string;
  amountSol: number;
  payoutSol: number;
  multiplier: number | null;
  result: string | null;
  createdAt: string;
}

export async function fetchHistory(
  walletAddress: string,
): Promise<BetHistory[]> {
  const res = await fetch(`${API_URL}/api/history/${walletAddress}`);
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  totalWageredSol: number;
  totalWonSol: number;
  balanceSol: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/leaderboard`);
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

export function formatSol(amount: number, decimals = 4): string {
  return amount.toFixed(decimals);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
