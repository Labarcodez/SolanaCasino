import { PublicKey } from "@solana/web3.js";

export const CASINO_WALLET =
  import.meta.env.VITE_CASINO_WALLET ??
  "C9W7nGv2ZBJp4zcmtvBHkrtTPhB1FQ7JaNNPRNhiA4Ze";

export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID ??
    "Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU",
);

export const API_URL = import.meta.env.VITE_API_URL ?? "";
export const PHANTOM_APP_ID = import.meta.env.VITE_PHANTOM_APP_ID ?? "";
export const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC ?? "https://solana.drpc.org";

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

/** Read wallet address from stored JWT without verifying (client-side session hint). */
export function getSessionWalletAddress(): string | null {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized)) as { walletAddress?: string };
    return typeof payload.walletAddress === "string" ? payload.walletAddress : null;
  } catch {
    return null;
  }
}

export function hasStoredSession(): boolean {
  return getAuthToken() !== null;
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
  programId: string;
  cluster: string;
  clientRpcUrl?: string;
  solanaRpcUrl?: string;
  rpcProvider?: "alchemy" | "helius" | "custom" | "public";
  alchemyConfigured?: boolean;
  onChainEnabled: boolean;
  casinoInitialized: boolean;
  casinoPda: string;
  vaultPda: string;
  minBetSol: number;
  maxBetSol: number;
  minWithdrawSol: number;
  houseEdge: number;
  limboHouseEdge?: number;
  limboMinTarget?: number;
  limboMaxTarget?: number;
  withdrawalsEnabled: boolean;
  socialLoginEnabled?: boolean;
  adminWallet?: string;
  casinoPaused?: boolean;
}

export interface UserProfile {
  walletAddress: string;
  displayName: string;
  email: string | null;
  authProvider: string;
  balanceSol: number;
  balanceLamports: number;
  onChainBalanceSol: number;
  totalWageredSol: number;
  totalWonSol: number;
  playerInitialized?: boolean;
  onChainEnabled?: boolean;
  memberSince?: string;
  netPnlSol?: number;
  vipTier?: string;
  vipLabel?: string;
  vipRakebackPercent?: number;
  wagered30dSol?: number;
  nextVipTier?: string | null;
  nextVipWagerSol?: number | null;
  rakebackPendingSol?: number;
  referralCode?: string;
  referralLink?: string;
  referredCount?: number;
  pendingCommissionSol?: number;
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
  profile?: {
    authProvider?: string;
    email?: string;
    displayName?: string;
    referralCode?: string;
  },
): Promise<{
  token: string;
  walletAddress: string;
  profile?: { displayName: string; email: string | null; authProvider: string };
}> {
  const res = await fetch(`${API_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      signature,
      message,
      ...profile,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Authentication failed");
  return data;
}

export async function updateProfile(displayName: string): Promise<{
  walletAddress: string;
  displayName: string;
  email: string | null;
  authProvider: string;
}> {
  const res = await apiFetch("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Profile update failed");
  return data;
}

export async function fetchUser(walletAddress: string): Promise<UserProfile> {
  const res = await apiFetch(`/api/user/${walletAddress}`);
  if (!res.ok) throw new Error("Failed to load user");
  return res.json();
}

export async function prepareDeposit(
  walletAddress: string,
  amountSol: number,
): Promise<{ transaction: string; amountSol: number; casinoWallet: string }> {
  const res = await apiFetch("/api/deposit/prepare", {
    method: "POST",
    body: JSON.stringify({ walletAddress, amountSol }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to prepare deposit");
  return data;
}

export async function verifyDeposit(
  signature: string,
  walletAddress: string,
): Promise<{ success: boolean; amountSol: number; balanceSol: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let res: Response;
  try {
    res = await apiFetch("/api/deposit/verify", {
      method: "POST",
      body: JSON.stringify({ signature, walletAddress }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "Deposit verification timed out — check Solscan and contact support if SOL was sent",
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

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

export async function prepareCoinflip(
  walletAddress: string,
  clientSeed?: string,
): Promise<{
  prepareId: string;
  serverSeedHash: string;
  clientSeed: string;
}> {
  const res = await apiFetch("/api/coinflip/prepare", {
    method: "POST",
    body: JSON.stringify({ walletAddress, clientSeed }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to prepare coinflip");
  return data;
}

export async function revealCoinflip(
  walletAddress: string,
  prepareId: string,
): Promise<{
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
}> {
  const res = await apiFetch("/api/coinflip/reveal", {
    method: "POST",
    body: JSON.stringify({ walletAddress, prepareId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to reveal coinflip seed");
  return data;
}

export async function confirmCoinflip(params: {
  walletAddress: string;
  amountSol: number;
  choice: "heads" | "tails";
  clientSeed: string;
  serverSeed: string;
  signature: string;
}): Promise<CoinflipResult> {
  const res = await apiFetch("/api/coinflip/confirm", {
    method: "POST",
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to confirm coinflip");
  return data;
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
  displayName: string;
  totalWageredSol: number;
  totalWonSol: number;
  balanceSol: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/api/leaderboard`);
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

export interface RecentWin {
  walletAddress: string;
  displayName?: string;
  game: string;
  payoutSol: number;
  amountSol: number;
  multiplier?: number;
}

export async function fetchRecentWins(): Promise<RecentWin[]> {
  const res = await fetch(`${API_URL}/api/recent-wins`);
  if (!res.ok) throw new Error("Failed to load recent wins");
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

export interface LimboResult {
  betId: string;
  targetMultiplier: number;
  resultMultiplier: number;
  roll: number;
  won: boolean;
  payoutSol: number;
  balanceSol: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
}

export async function playLimbo(
  walletAddress: string,
  amountSol: number,
  targetMultiplier: number,
  clientSeed?: string,
): Promise<LimboResult> {
  const res = await apiFetch("/api/limbo", {
    method: "POST",
    body: JSON.stringify({ walletAddress, amountSol, targetMultiplier, clientSeed }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Limbo bet failed");
  return data;
}

export async function prepareLimbo(
  walletAddress: string,
  targetMultiplier: number,
  clientSeed?: string,
): Promise<{
  prepareId: string;
  serverSeedHash: string;
  clientSeed: string;
}> {
  const res = await apiFetch("/api/limbo/prepare", {
    method: "POST",
    body: JSON.stringify({ walletAddress, targetMultiplier, clientSeed }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to prepare limbo");
  return data;
}

export async function revealLimbo(
  walletAddress: string,
  prepareId: string,
): Promise<{
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  targetMultiplier?: number;
}> {
  const res = await apiFetch("/api/limbo/reveal", {
    method: "POST",
    body: JSON.stringify({ walletAddress, prepareId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to reveal limbo seed");
  return data;
}

export async function confirmLimbo(params: {
  walletAddress: string;
  amountSol: number;
  targetMultiplier: number;
  clientSeed: string;
  serverSeed: string;
  signature: string;
}): Promise<LimboResult> {
  const res = await apiFetch("/api/limbo/confirm", {
    method: "POST",
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to confirm limbo");
  return data;
}

export interface AffiliateStats {
  referralCode: string;
  referralLink: string;
  referredCount: number;
  totalCommissionSol: number;
  pendingCommissionSol: number;
}

export async function fetchAffiliateStats(): Promise<AffiliateStats> {
  const res = await apiFetch("/api/affiliate");
  if (!res.ok) throw new Error("Failed to load affiliate stats");
  return res.json();
}

export async function claimRakeback(): Promise<{
  claimedSol: number;
  balanceSol: number | null;
  signature?: string;
  onChain?: boolean;
}> {
  const res = await apiFetch("/api/rakeback/claim", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Rakeback claim failed");
  return data;
}

export async function confirmCrashBet(params: {
  walletAddress: string;
  roundId: number;
  amountSol: number;
  autoCashout?: number;
  signature: string;
}): Promise<{ betId: string; roundId: number; signature: string }> {
  const res = await apiFetch("/api/crash/confirm", {
    method: "POST",
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to confirm crash bet");
  return data;
}

export interface AdminDashboard {
  casinoPaused: boolean;
  onChainEnabled: boolean;
  withdrawalsEnabled: boolean;
  totalUsers: number;
  totalBets: number;
  handle24hSol: number;
  grossRevenue24hSol: number;
  pendingWithdrawals: Array<{
    id: string;
    walletAddress: string;
    amountSol: number;
    createdAt: string;
  }>;
  tournamentPrizePoolSol: number;
  indexer: { enabled: boolean; lastSignature: string | null; indexedBets: number };
  adminWallet: string;
}

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const res = await apiFetch("/api/admin/dashboard");
  if (!res.ok) throw new Error("Failed to load admin dashboard");
  return res.json();
}

export async function claimAffiliate(): Promise<{
  claimedSol: number;
  balanceSol: number | null;
  signature?: string;
  onChain?: boolean;
}> {
  const res = await apiFetch("/api/affiliate/claim", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Affiliate claim failed");
  return data;
}

export async function processWithdrawal(withdrawalId: string): Promise<{ signature: string }> {
  const res = await apiFetch(`/api/admin/withdrawals/${withdrawalId}/process`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to process withdrawal");
  return data;
}

export async function setCasinoPaused(paused: boolean): Promise<{ signature?: string }> {
  const res = await apiFetch("/api/admin/pause", {
    method: "POST",
    body: JSON.stringify({ paused }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update pause state");
  return data;
}

export interface TournamentData {
  weekId: string;
  weekEnd: string;
  prizePoolSol: number;
  entries: Array<{
    rank: number;
    displayName: string;
    walletAddress: string;
    wageredSol: number;
    estimatedPrizeSol: number;
  }>;
}

export async function fetchTournament(): Promise<TournamentData> {
  const res = await fetch(`${API_URL}/api/tournament`);
  if (!res.ok) throw new Error("Failed to load tournament");
  return res.json();
}

export interface CasinoStats {
  casinoWallet: string;
  casinoBalanceSol: number;
  totalUsers: number;
  totalBets: number;
  handle24hSol: number;
  grossRevenue24hSol: number;
  affiliateCommissionsSol: number;
  tournamentPrizePoolSol: number;
  tournamentWeekEnd: string;
}

export async function fetchCasinoStats(): Promise<CasinoStats> {
  const res = await fetch(`${API_URL}/api/casino/stats`);
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function verifyLimboFairness(params: {
  serverSeed: string;
  betId: string;
  clientSeed: string;
  targetMultiplier: number;
  expectedWon: boolean;
}): Promise<{ valid: boolean; roll: number; won: boolean }> {
  const res = await fetch(`${API_URL}/api/fairness/verify-limbo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

const REFERRAL_KEY = "orbitcasino_ref";

export function storeReferralCode(code: string): void {
  sessionStorage.setItem(REFERRAL_KEY, code.toUpperCase());
}

export function getStoredReferralCode(): string | null {
  return sessionStorage.getItem(REFERRAL_KEY);
}

export function captureReferralFromUrl(): void {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref) storeReferralCode(ref);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
