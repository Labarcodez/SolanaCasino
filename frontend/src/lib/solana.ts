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
import { CASINO_WALLET, SOLANA_RPC } from "./api";
import { getSolanaRpc } from "./cluster";

function resolveRpcUrl(rpcUrl?: string): string {
  return rpcUrl ?? getSolanaRpc() ?? SOLANA_RPC;
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
  const { balanceLamports } = await fetchPlayerBalance(walletAddress);

  return {
    signature: normalizeTxSignature(signature),
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
  const { balanceLamports } = await fetchPlayerBalance(walletAddress);

  return {
    signature: normalizeTxSignature(signature),
    balanceSol: balanceLamports / LAMPORTS_PER_SOL,
  };
}
