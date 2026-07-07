import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config.js";

export const connection = new Connection(config.solanaRpcUrl, "confirmed");
export const casinoPublicKey = new PublicKey(config.casinoWalletAddress);

let casinoKeypair: Keypair | null = null;

if (config.casinoWalletPrivateKey) {
  try {
    const decoded = bs58.decode(config.casinoWalletPrivateKey);
    casinoKeypair = Keypair.fromSecretKey(decoded);
    if (casinoKeypair.publicKey.toBase58() !== config.casinoWalletAddress) {
      console.warn(
        "CASINO_WALLET_PRIVATE_KEY does not match CASINO_WALLET_ADDRESS",
      );
      casinoKeypair = null;
    }
  } catch {
    console.warn("Invalid CASINO_WALLET_PRIVATE_KEY — withdrawals disabled");
  }
}

export async function verifyDeposit(
  signature: string,
  expectedSender: string,
  minLamports: number,
): Promise<{ valid: boolean; amount: number; error?: string }> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx || tx.meta?.err) {
      return { valid: false, amount: 0, error: "Transaction not found or failed" };
    }

    const instructions = tx.transaction.message.instructions;
    let transferAmount = 0;

    for (const ix of instructions) {
      if ("parsed" in ix && ix.program === "system") {
        const parsed = ix.parsed as {
          type: string;
          info: { source: string; destination: string; lamports: number };
        };
        if (
          parsed.type === "transfer" &&
          parsed.info.destination === config.casinoWalletAddress &&
          parsed.info.source === expectedSender
        ) {
          transferAmount += parsed.info.lamports;
        }
      }
    }

    if (transferAmount < minLamports) {
      return {
        valid: false,
        amount: transferAmount,
        error: `Transfer amount too small (min ${minLamports / LAMPORTS_PER_SOL} SOL)`,
      };
    }

    return { valid: true, amount: transferAmount };
  } catch (err) {
    return {
      valid: false,
      amount: 0,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}

export async function sendWithdrawal(
  toAddress: string,
  lamports: number,
): Promise<{ signature: string }> {
  if (!casinoKeypair) {
    throw new Error(
      "Casino wallet private key not configured — withdrawals unavailable",
    );
  }

  const toPubkey = new PublicKey(toAddress);
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: casinoKeypair.publicKey,
      toPubkey,
      lamports,
    }),
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [
    casinoKeypair,
  ]);

  return { signature };
}

export async function getWalletBalance(address: string): Promise<number> {
  const pubkey = new PublicKey(address);
  return connection.getBalance(pubkey);
}

export async function getCasinoWalletBalance(): Promise<number> {
  return connection.getBalance(casinoPublicKey);
}

export function isWithdrawalEnabled(): boolean {
  return casinoKeypair !== null;
}
