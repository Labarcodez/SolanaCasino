import { Connection, PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { config } from "../config.js";
import { getConnection, isAnchorEnabled } from "./anchor.js";
import { PROGRAM_ID } from "./pdas.js";

const INDEXED_SIGS_KEY = "indexer_last_signature";

export function indexBetFromConfirm(params: {
  walletAddress: string;
  game: string;
  amountLamports: number;
  payoutLamports: number;
  multiplier: number;
  result: string;
  signature: string;
  metadata?: Record<string, unknown>;
}): string {
  const existing = db
    .prepare("SELECT id FROM bets WHERE json_extract(metadata, '$.signature') = ?")
    .get(params.signature) as { id: string } | undefined;

  if (existing) return existing.id;

  const betId = uuidv4();
  db.prepare(
    `INSERT INTO bets (id, wallet_address, game, amount_lamports, payout_lamports, multiplier, result, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    betId,
    params.walletAddress,
    params.game,
    params.amountLamports,
    params.payoutLamports,
    params.multiplier,
    params.result,
    JSON.stringify({ ...params.metadata, signature: params.signature, onChain: true }),
  );

  return betId;
}

export function getIndexerStatus(): {
  enabled: boolean;
  lastSignature: string | null;
  indexedBets: number;
} {
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM bets WHERE json_extract(metadata, '$.onChain') = 1",
    )
    .get() as { count: number };

  const meta = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(INDEXED_SIGS_KEY) as { value: string } | undefined;

  return {
    enabled: isAnchorEnabled(),
    lastSignature: meta?.value ?? null,
    indexedBets: row.count,
  };
}

async function ensureAppMetaTable(): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function syncOnChainTransactions(): Promise<number> {
  if (!isAnchorEnabled()) return 0;

  await ensureAppMetaTable();

  const connection: Connection = getConnection();
  const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, {
    limit: 25,
  });

  if (signatures.length === 0) return 0;

  const lastStored = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(INDEXED_SIGS_KEY) as { value: string } | undefined;

  let synced = 0;
  for (const sigInfo of signatures) {
    if (lastStored?.value === sigInfo.signature) break;

    const existing = db
      .prepare(
        "SELECT id FROM bets WHERE json_extract(metadata, '$.signature') = ?",
      )
      .get(sigInfo.signature);
    if (existing) continue;

    synced++;
  }

  if (signatures[0]) {
    db.prepare(
      "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(INDEXED_SIGS_KEY, signatures[0].signature);
  }

  return synced;
}

let indexerInterval: ReturnType<typeof setInterval> | null = null;

export function startBetIndexer(): void {
  if (!isAnchorEnabled() || indexerInterval) return;

  void syncOnChainTransactions().catch(console.error);

  indexerInterval = setInterval(() => {
    void syncOnChainTransactions().catch(console.error);
  }, 60_000);

  console.log("Bet indexer started");
}
