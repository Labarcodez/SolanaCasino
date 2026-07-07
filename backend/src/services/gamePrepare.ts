import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import {
  generateServerSeed,
  hashServerSeedBytes,
} from "./provablyFair.js";

const PREPARE_TTL_MS = 5 * 60 * 1000;

export interface GamePrepareResult {
  prepareId: string;
  serverSeedHash: string;
  clientSeed: string;
}

export function createGamePrepare(params: {
  walletAddress: string;
  game: string;
  clientSeed?: string;
  metadata?: Record<string, unknown>;
}): GamePrepareResult {
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeedBytes(serverSeed);
  const clientSeed =
    params.clientSeed ?? uuidv4().replace(/-/g, "").slice(0, 32);
  const prepareId = uuidv4();
  const expiresAt = new Date(Date.now() + PREPARE_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO pending_game_prepares
     (id, wallet_address, game, server_seed_hash, server_seed, client_seed, metadata, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    prepareId,
    params.walletAddress,
    params.game,
    serverSeedHash,
    serverSeed,
    clientSeed,
    params.metadata ? JSON.stringify(params.metadata) : null,
    expiresAt,
  );

  return { prepareId, serverSeedHash, clientSeed };
}

export function revealGamePrepare(
  prepareId: string,
  walletAddress: string,
): {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  metadata: Record<string, unknown> | null;
} {
  const row = db
    .prepare(
      `SELECT * FROM pending_game_prepares
       WHERE id = ? AND wallet_address = ? AND used = 0`,
    )
    .get(prepareId, walletAddress) as
    | {
        server_seed: string;
        server_seed_hash: string;
        client_seed: string;
        metadata: string | null;
        expires_at: string;
      }
    | undefined;

  if (!row) {
    throw new Error("Prepare session not found or already used");
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("Prepare session expired");
  }

  db.prepare(
    "UPDATE pending_game_prepares SET used = 1 WHERE id = ?",
  ).run(prepareId);

  return {
    serverSeed: row.server_seed,
    serverSeedHash: row.server_seed_hash,
    clientSeed: row.client_seed,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
  };
}

export function purgeExpiredPrepares(): void {
  db.prepare(
    "DELETE FROM pending_game_prepares WHERE expires_at < datetime('now') OR used = 1",
  ).run();
}
