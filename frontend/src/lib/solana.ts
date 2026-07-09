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

export type TxSignature = string | Uint8Array;

export function normalizeTxSignature(signature: TxSignature): string {
  if (typeof signature === "string") {
    return signature;
  }
  return bs58.encode(signature);
}

export async function buildDepositTransaction(
  fromAddress: string,
  amountSol: number,
  casinoWallet: string = CASINO_WALLET,
): Promise<Transaction> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
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
): Promise<Transaction> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
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
