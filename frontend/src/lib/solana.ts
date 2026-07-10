import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import {
  buildDepositTransaction as buildAnchorDeposit,
  buildWithdrawTransaction,
  ensurePlayerInitialized,
  fetchPlayerBalance,
} from "./anchor";
import { CASINO_WALLET, API_URL, SOLANA_RPC } from "./api";
import { getSolanaCluster, getSolanaRpc } from "./cluster";

const MAINNET_RPC_FALLBACKS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];

const DEVNET_RPC_FALLBACKS = ["https://api.devnet.solana.com"];

function isBrowserSafeRpc(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    !lower.includes("alchemy.com") &&
    !lower.includes("helius-rpc.com") &&
    !url.includes("***")
  );
}

function clusterRpcFallbacks(): string[] {
  const cluster = getSolanaCluster();
  return cluster === "mainnet-beta" || cluster === "mainnet"
    ? MAINNET_RPC_FALLBACKS
    : DEVNET_RPC_FALLBACKS;
}

function getClientRpcCandidates(rpcUrl?: string): string[] {
  const seen = new Set<string>();
  const ordered = [rpcUrl, getSolanaRpc(), SOLANA_RPC, ...clusterRpcFallbacks()].filter(
    (url): url is string => Boolean(url),
  );
  return ordered.filter((url) => {
    if (!isBrowserSafeRpc(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function resolveRpcUrl(rpcUrl?: string): string {
  const candidates = getClientRpcCandidates(rpcUrl);
  if (candidates.length === 0) {
    return clusterRpcFallbacks()[0];
  }
  return candidates[0];
}

async function fetchLatestBlockhashFromServer(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const res = await fetch(`${API_URL}/api/rpc/latest-blockhash`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to fetch blockhash from server");
  }
  return res.json() as Promise<{ blockhash: string; lastValidBlockHeight: number }>;
}

export function transactionFromBase64(serializedBase64: string): Transaction {
  const binary = atob(serializedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return Transaction.from(bytes);
}

export type TxSignature = string | Uint8Array | number[];

export function normalizeTxSignature(signature: TxSignature | unknown): string {
  if (typeof signature === "string") {
    if (signature.startsWith("[")) {
      try {
        const bytes = JSON.parse(signature) as number[];
        return bs58.encode(Uint8Array.from(bytes));
      } catch {
        return signature;
      }
    }
    return signature;
  }
  if (signature instanceof Uint8Array) {
    return bs58.encode(signature);
  }
  if (Array.isArray(signature)) {
    return bs58.encode(Uint8Array.from(signature));
  }
  throw new Error("Invalid transaction signature format");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForTransactionConfirmation(
  signature: string,
  timeoutMs = 90_000,
  rpcUrl?: string,
): Promise<void> {
  const connection = new Connection(resolveRpcUrl(rpcUrl), "confirmed");
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];

    if (status?.err) {
      throw new Error("Transaction failed on-chain");
    }

    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }

    await sleep(1500);
  }

  throw new Error("Transaction confirmation timed out — check Solscan and retry");
}

export async function refreshTransactionBlockhash(
  tx: Transaction,
  feePayer: string,
): Promise<void> {
  const applyBlockhash = (blockhash: string, lastValidBlockHeight: number) => {
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(feePayer);
    tx.lastValidBlockHeight = lastValidBlockHeight;
  };

  try {
    const fromServer = await fetchLatestBlockhashFromServer();
    applyBlockhash(fromServer.blockhash, fromServer.lastValidBlockHeight);
    return;
  } catch {
    // Fall back to public browser RPCs if server endpoint is unavailable.
  }

  let lastError: Error | null = null;
  for (const url of getClientRpcCandidates()) {
    try {
      const connection = new Connection(url, "confirmed");
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      applyBlockhash(blockhash, lastValidBlockHeight);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Could not refresh transaction blockhash");
}

export async function buildDepositTransaction(
  fromAddress: string,
  amountSol: number,
  casinoWallet: string = CASINO_WALLET,
  rpcUrl?: string,
): Promise<Transaction> {
  const connection = new Connection(resolveRpcUrl(rpcUrl), "confirmed");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(fromAddress),
      toPubkey: new PublicKey(casinoWallet),
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    }),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(fromAddress);
  return tx;
}

async function prepareTransaction(
  walletAddress: string,
  tx: Transaction,
  rpcUrl?: string,
): Promise<Transaction> {
  const connection = new Connection(resolveRpcUrl(rpcUrl), "confirmed");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(walletAddress);
  return tx;
}

export async function depositOnChain(
  walletAddress: string,
  amountSol: number,
  signAndSend: (tx: Transaction) => Promise<{ signature: TxSignature }>,
): Promise<{ signature: string; balanceSol: number }> {
  const signAndSendNormalized = async (tx: Transaction) => {
    const result = await signAndSend(tx);
    return { signature: normalizeTxSignature(result.signature) };
  };

  await ensurePlayerInitialized(walletAddress, signAndSendNormalized);

  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const tx = await buildAnchorDeposit(walletAddress, amountLamports);
  await prepareTransaction(walletAddress, tx);

  const { signature } = await signAndSend(tx);
  const normalized = normalizeTxSignature(signature);
  await waitForTransactionConfirmation(normalized);
  const { balanceLamports } = await fetchPlayerBalance(walletAddress);

  return {
    signature: normalized,
    balanceSol: balanceLamports / LAMPORTS_PER_SOL,
  };
}

export async function withdrawOnChain(
  walletAddress: string,
  amountSol: number,
  signAndSend: (tx: Transaction) => Promise<{ signature: TxSignature }>,
): Promise<{ signature: string; balanceSol: number }> {
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const tx = await buildWithdrawTransaction(walletAddress, amountLamports);
  await prepareTransaction(walletAddress, tx);

  const { signature } = await signAndSend(tx);
  const normalized = normalizeTxSignature(signature);
  await waitForTransactionConfirmation(normalized);
  const { balanceLamports } = await fetchPlayerBalance(walletAddress);

  return {
    signature: normalized,
    balanceSol: balanceLamports / LAMPORTS_PER_SOL,
  };
}
