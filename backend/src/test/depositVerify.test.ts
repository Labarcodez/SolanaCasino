import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { extractDepositTransferLamports } from "../services/depositVerify.js";

const sender = Keypair.generate().publicKey;
const casino = Keypair.generate().publicKey;

function mockTx(overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      err: null,
      fee: 5000,
      preBalances: [1_000_000, 0],
      postBalances: [989_000, 10_000],
      innerInstructions: [],
      ...(overrides.meta as object),
    },
    transaction: {
      message: {
        accountKeys: [sender, casino],
        instructions: (overrides.instructions as unknown[]) ?? [],
      },
    },
  } as Parameters<typeof extractDepositTransferLamports>[0];
}

assert.equal(
  extractDepositTransferLamports(
    mockTx({
      instructions: [
        {
          program: "system",
          parsed: {
            type: "transfer",
            info: {
              source: sender.toBase58(),
              destination: casino.toBase58(),
              lamports: 10_000,
            },
          },
        },
      ],
    }),
    sender.toBase58(),
    casino.toBase58(),
  ),
  10_000,
);

assert.equal(
  extractDepositTransferLamports(mockTx(), sender.toBase58(), casino.toBase58()),
  10_000,
);

console.log("✅ Deposit verify extraction tests passed");
