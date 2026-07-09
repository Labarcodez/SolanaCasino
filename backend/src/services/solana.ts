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
import { extractDepositTransferLamports } from "./depositVerify.js";

const RPC_TIMEOUT_MS = 12_000;
const DEPOSIT_VERIFY_ATTEMPTS = 12;

const rpcEndpoints = [
  config.solanaRpcUrl,
  config.solanaRpcFallback,
].filter((url, index, arr) => arr.indexOf(url) === index);

export const connection = new Connection(rpcEndpoints[0], "confirmed");
export const casinoPublicKey = new PublicKey(config.casinoWalletAddress);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function withRpcFallback<T>(
  operation: (conn: Connection) => Promise<T>,
  label = "RPC request",
): Promise<T> {
  let lastError: Error | null = null;

  for (const endpoint of rpcEndpoints) {
    try {
      const conn = new Connection(endpoint, "confirmed");
      return await withTimeout(
        operation(conn),
        RPC_TIMEOUT_MS,
        `${label} (${endpoint})`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`RPC ${endpoint} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error("All RPC endpoints failed");
}

export async function checkRpcHealth(): Promise<{
  healthy: boolean;
  endpoint: string;
  slot?: number;
  error?: string;
}> {
  for (const endpoint of rpcEndpoints) {
    try {
      const conn = new Connection(endpoint, "confirmed");
      const slot = await conn.getSlot();
      return { healthy: true, endpoint, slot };
    } catch (err) {
      console.warn(`Health check failed for ${endpoint}`);
    }
  }

  return {
    healthy: false,
    endpoint: rpcEndpoints[0],
    error: "All RPC endpoints unreachable",
  };
}

export async function verifyDeposit(
  signature: string,
  expectedSender: string,
  minLamports: number,
): Promise<{ valid: boolean; amount: number; error?: string }> {
  for (let attempt = 0; attempt < DEPOSIT_VERIFY_ATTEMPTS; attempt++) {
    try {
      const result = await withRpcFallback(async (conn) => {
        const status = await conn.getSignatureStatuses([signature], {
          searchTransactionHistory: true,
        });
        const statusValue = status.value[0];

        if (statusValue?.err) {
          return {
            valid: false as const,
            amount: 0,
            error: "Transaction failed on-chain",
            pending: false,
          };
        }

        const tx = await conn.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        if (!tx) {
          return {
            valid: false as const,
            amount: 0,
            error: "Transaction not found yet",
            pending: true,
          };
        }

        if (tx.meta?.err) {
          return {
            valid: false as const,
            amount: 0,
            error: "Transaction failed on-chain",
            pending: false,
          };
        }

        const transferAmount = extractDepositTransferLamports(
          tx,
          expectedSender,
          config.casinoWalletAddress,
        );

        if (transferAmount < minLamports) {
          return {
            valid: false as const,
            amount: transferAmount,
            error:
              transferAmount === 0
                ? "No SOL transfer to the casino wallet was found in this transaction"
                : `Transfer amount too small (min ${minLamports / LAMPORTS_PER_SOL} SOL)`,
            pending: false,
          };
        }

        return { valid: true as const, amount: transferAmount, pending: false };
      }, "verify deposit");

      if (result.pending && attempt < DEPOSIT_VERIFY_ATTEMPTS - 1) {
        await sleep(1000 + attempt * 500);
        continue;
      }

      if (!result.valid && "error" in result) {
        return { valid: false, amount: result.amount, error: result.error };
      }

      return { valid: true, amount: result.amount };
    } catch (err) {
      if (attempt === DEPOSIT_VERIFY_ATTEMPTS - 1) {
        return {
          valid: false,
          amount: 0,
          error: err instanceof Error ? err.message : "Verification failed",
        };
      }
      await sleep(1000);
    }
  }

  return {
    valid: false,
    amount: 0,
    error: "Deposit confirmation timed out — try again in a moment",
  };
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

  return withRpcFallback(async (conn) => {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: casinoKeypair!.publicKey,
        toPubkey,
        lamports,
      }),
    );

    const signature = await sendAndConfirmTransaction(conn, transaction, [
      casinoKeypair!,
    ]);

    return { signature };
  });
}

export async function getWalletBalance(address: string): Promise<number> {
  const pubkey = new PublicKey(address);
  return withRpcFallback((conn) => conn.getBalance(pubkey));
}

export async function getCasinoWalletBalance(): Promise<number> {
  return withRpcFallback((conn) => conn.getBalance(casinoPublicKey));
}

export function isWithdrawalEnabled(): boolean {
  return casinoKeypair !== null;
}

export function getRpcEndpoints(): string[] {
  return rpcEndpoints;
}
