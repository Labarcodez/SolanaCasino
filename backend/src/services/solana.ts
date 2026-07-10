import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config.js";
import { extractDepositTransferLamports } from "./depositVerify.js";

const RPC_TIMEOUT_MS = 12_000;
const WITHDRAW_CONFIRM_TIMEOUT_MS = 90_000;
const DEPOSIT_VERIFY_ATTEMPTS = 36;

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

/** Withdrawal was broadcast but not yet confirmed — do NOT restore casino balance. */
export class WithdrawalPendingError extends Error {
  constructor(
    message: string,
    readonly signature: string,
  ) {
    super(message);
    this.name = "WithdrawalPendingError";
  }
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
  timeoutMs = RPC_TIMEOUT_MS,
): Promise<T> {
  let lastError: Error | null = null;

  for (const endpoint of rpcEndpoints) {
    try {
      const conn = new Connection(endpoint, "confirmed");
      return await withTimeout(
        operation(conn),
        timeoutMs,
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

export async function buildDepositTransactionForWallet(
  fromAddress: string,
  lamports: number,
): Promise<{ transaction: string }> {
  return withRpcFallback(async (conn) => {
    const { blockhash, lastValidBlockHeight } =
      await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(fromAddress),
        toPubkey: casinoPublicKey,
        lamports,
      }),
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(fromAddress);
    tx.lastValidBlockHeight = lastValidBlockHeight;

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return { transaction: Buffer.from(serialized).toString("base64") };
  }, "prepare deposit");
}

/** Poll until a signature is confirmed/finalized or failed on-chain. */
export async function waitForSignatureConfirmation(
  conn: Connection,
  signature: string,
  timeoutMs: number,
): Promise<"confirmed" | "failed" | "timeout"> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { value } = await conn.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];

    if (status?.err) {
      return "failed";
    }

    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return "confirmed";
    }

    await sleep(1500);
  }

  return "timeout";
}

/**
 * Send a custodial payout using send + confirm (not sendAndConfirmTransaction).
 * Avoids false timeouts and never returns until the tx is confirmed, failed, or
 * the blockhash window expires — per Solana retry/confirmation guides.
 */
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
  let lastError: Error | null = null;

  for (const endpoint of rpcEndpoints) {
    try {
      const conn = new Connection(endpoint, "confirmed");
      const { blockhash, lastValidBlockHeight } = await withTimeout(
        conn.getLatestBlockhash("confirmed"),
        RPC_TIMEOUT_MS,
        "getLatestBlockhash",
      );

      const transaction = new Transaction({
        feePayer: casinoKeypair.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(
        SystemProgram.transfer({
          fromPubkey: casinoKeypair.publicKey,
          toPubkey,
          lamports,
        }),
      );

      transaction.sign(casinoKeypair);
      const raw = transaction.serialize();

      const signature = await conn.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 0,
        preflightCommitment: "confirmed",
      });

      const confirmResult = await waitForSignatureConfirmation(
        conn,
        signature,
        WITHDRAW_CONFIRM_TIMEOUT_MS,
      );

      if (confirmResult === "confirmed") {
        return { signature };
      }

      if (confirmResult === "failed") {
        throw new Error("Withdrawal transaction failed on-chain");
      }

      // Timed out polling — check if blockhash expired without landing.
      const blockHeight = await conn.getBlockHeight("confirmed");
      if (blockHeight > lastValidBlockHeight) {
        const finalStatus = await waitForSignatureConfirmation(
          conn,
          signature,
          5_000,
        );
        if (finalStatus === "confirmed") {
          return { signature };
        }
        throw new Error("Withdrawal expired before confirmation — balance restored");
      }

      // Still within blockhash window; keep polling a bit longer.
      const lateConfirm = await waitForSignatureConfirmation(
        conn,
        signature,
        30_000,
      );
      if (lateConfirm === "confirmed") {
        return { signature };
      }

      throw new WithdrawalPendingError(
        "Withdrawal is still confirming — SOL may already be in your wallet. Balance will update shortly.",
        signature,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Withdraw RPC ${endpoint} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error("Withdrawal failed on all RPC endpoints");
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

export async function getLatestBlockhashForClient(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  return withRpcFallback(async (conn) => {
    const result = await conn.getLatestBlockhash("confirmed");
    return {
      blockhash: result.blockhash,
      lastValidBlockHeight: result.lastValidBlockHeight,
    };
  }, "latest blockhash");
}

export function getRpcEndpoints(): string[] {
  return rpcEndpoints;
}
