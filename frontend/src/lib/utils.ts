import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { SOLANA_RPC } from "./api";
import { getSolanaCluster, isMainnetCluster } from "./cluster";

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function solscanTxUrl(
  signature: string,
  cluster = getSolanaCluster(),
): string {
  if (isMainnetCluster(cluster)) {
    return `https://solscan.io/tx/${signature}`;
  }
  return `https://solscan.io/tx/${signature}?cluster=${cluster}`;
}

export function solscanAccountUrl(
  address: string,
  cluster = getSolanaCluster(),
): string {
  if (isMainnetCluster(cluster)) {
    return `https://solscan.io/account/${address}`;
  }
  return `https://solscan.io/account/${address}?cluster=${cluster}`;
}

export async function prepareTransaction(
  walletAddress: string,
  tx: Transaction,
): Promise<Transaction> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(walletAddress);
  return tx;
}

export function multiplierColor(mult: number): string {
  if (mult < 1.5) return "var(--danger)";
  if (mult < 3) return "var(--warning)";
  if (mult < 10) return "var(--solana-green)";
  return "var(--accent)";
}

export function formatMultiplier(mult: number): string {
  return `${mult.toFixed(2)}x`;
}
