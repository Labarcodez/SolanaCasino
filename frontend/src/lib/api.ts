export const CASINO_WALLET =
  import.meta.env.VITE_CASINO_WALLET ??
  "FMmho438Vv1Y9nov4mtfHZ4pYSZV8NfubiCeCB3bbGCb";

export const API_URL = import.meta.env.VITE_API_URL ?? "";
export const PHANTOM_APP_ID = import.meta.env.VITE_PHANTOM_APP_ID ?? "";
export const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ??
  "https://rpc.solanatracker.io/public";

const AUTH_TOKEN_KEY = "solcasino_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export interface CasinoConfig {
  casinoWallet: string;
  minBetSol: number;
  maxBetSol: number;
  minWithdrawSol: number;
  houseEdge: number;
  withdrawalsEnabled: boolean;
  socialLoginEnabled?: boolean;
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

export async function requestAuthNonce(
  walletAddress: string,
): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API_URL}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to get auth nonce");
  return data;
}

export async function verifyAuth(
  walletAddress: string,
  signature: string,
  message: string,
): Promise<{ token: string; walletAddress: string }> {
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, signature, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Authentication failed");
  return data;
}

export async function fetchUser(walletAddress: string): Promise<UserProfile> {
  const res = await apiFetch(`/api/user/${walletAddress}`);
  if (!res.ok) throw new Error("Failed to load user");
  return res.json();
}

export async function verifyDeposit(
  signature: string,
  walletAddress: string,
): Promise<{ success: boolean; amountSol: number; balanceSol: number }> {
  const res = await apiFetch("/api/deposit/verify", {
    method: "POST",
    body: JSON.stringify({ signature, walletAddress }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Deposit failed");
  return data;
}

export async function withdraw(
  walletAddress: string,
  amountSol: number,
): Promise<{
  signature?: string;
  balanceSol: number;
  queued?: boolean;
  message?: string;
}> {
  const res = await apiFetch("/api/withdraw", {
    method: "POST",
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
  const res = await apiFetch("/api/coinflip", {
    method: "POST",
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
  const res = await apiFetch(`/api/history/${walletAddress}`);
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

export async function verifyCrashFairness(params: {
  serverSeed: string;
  serverSeedHash: string;
  roundId: string;
  clientSeeds?: string[];
  crashPoint: number;
}): Promise<{ valid: boolean }> {
  const res = await fetch(`${API_URL}/api/fairness/verify-crash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export function formatSol(amount: number, decimals = 4): string {
  return amount.toFixed(decimals);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
