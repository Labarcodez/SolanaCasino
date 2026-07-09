import { PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";

export function accountKeyToBase58(key: unknown): string {
  if (typeof key === "string") return key;
  if (key instanceof PublicKey) return key.toBase58();
  if (key && typeof key === "object" && "pubkey" in key) {
    return (key as { pubkey: PublicKey }).pubkey.toBase58();
  }
  return String(key);
}

type ParsedTransferInstruction = {
  parsed?: {
    type?: string;
    info?: { source?: string; destination?: string; lamports?: number };
  };
  program?: string;
};

function transferFromParsedInstruction(
  ix: ParsedTransferInstruction,
  expectedSender: string,
  expectedDestination: string,
): number {
  if (!("parsed" in ix) || ix.program !== "system") return 0;
  const parsed = ix.parsed;
  if (
    parsed?.type === "transfer" &&
    parsed.info?.destination === expectedDestination &&
    parsed.info?.source === expectedSender &&
    typeof parsed.info.lamports === "number"
  ) {
    return parsed.info.lamports;
  }
  return 0;
}

function transferFromBalanceChanges(
  tx: ParsedTransactionWithMeta,
  expectedSender: string,
  expectedDestination: string,
): number {
  const meta = tx.meta;
  if (!meta) return 0;

  const keys = tx.transaction.message.accountKeys.map(accountKeyToBase58);
  const senderIdx = keys.indexOf(expectedSender);
  const destIdx = keys.indexOf(expectedDestination);
  if (senderIdx < 0 || destIdx < 0) return 0;

  const received =
    meta.postBalances[destIdx] - meta.preBalances[destIdx];
  if (received <= 0) return 0;

  // Prefer amount credited to the casino wallet (fee is paid by sender separately).
  return received;
}

export function extractDepositTransferLamports(
  tx: ParsedTransactionWithMeta,
  expectedSender: string,
  expectedDestination: string,
): number {
  let transferAmount = 0;

  for (const ix of tx.transaction.message.instructions) {
    transferAmount += transferFromParsedInstruction(
      ix as ParsedTransferInstruction,
      expectedSender,
      expectedDestination,
    );
  }

  for (const inner of tx.meta?.innerInstructions ?? []) {
    for (const ix of inner.instructions) {
      transferAmount += transferFromParsedInstruction(
        ix as ParsedTransferInstruction,
        expectedSender,
        expectedDestination,
      );
    }
  }

  if (transferAmount === 0) {
    transferAmount = transferFromBalanceChanges(
      tx,
      expectedSender,
      expectedDestination,
    );
  }

  return transferAmount;
}
