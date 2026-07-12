import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { UserRow } from "./types.js";
import { runMigrations } from "./migrations.js";
import { ensureDataDir, getDbPath } from "../dataPaths.js";
import { archiveCorruptDatabase } from "./backup.js";
import { isSqliteCorruptionError, usesEfsPersistence } from "./sqliteErrors.js";

ensureDataDir();
const dbPath = getDbPath();

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    balance_lamports INTEGER NOT NULL DEFAULT 0,
    total_wagered_lamports INTEGER NOT NULL DEFAULT 0,
    total_won_lamports INTEGER NOT NULL DEFAULT 0,
    display_name TEXT,
    email TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'wallet',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    signature TEXT NOT NULL UNIQUE,
    amount_lamports INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    amount_lamports INTEGER NOT NULL,
    signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
  );

  CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    game TEXT NOT NULL,
    amount_lamports INTEGER NOT NULL,
    payout_lamports INTEGER NOT NULL DEFAULT 0,
    multiplier REAL,
    result TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
  );

  CREATE TABLE IF NOT EXISTS crash_rounds (
    id TEXT PRIMARY KEY,
    server_seed_hash TEXT NOT NULL,
    server_seed TEXT,
    crash_point REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'betting',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS auth_nonces (
    wallet_address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bets_wallet ON bets(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_bets_created ON bets(created_at);
  CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_address);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

  CREATE TABLE IF NOT EXISTS site_tokens (
    mint TEXT PRIMARY KEY,
    signature TEXT NOT NULL,
    registered_at TEXT DEFAULT (datetime('now'))
  );
`;

function backupCorruptDbFiles(targetPath: string, reason: string): void {
  archiveCorruptDatabase(targetPath, reason);
}

function configureDatabase(database: Database.Database): void {
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  // WAL on EFS/NFS corrupts SQLite — use DELETE journal on persistent ECS volume.
  if (usesEfsPersistence()) {
    database.pragma("journal_mode = DELETE");
    database.pragma("synchronous = FULL");
  } else {
    database.pragma("journal_mode = WAL");
  }
}

function initializeSchema(database: Database.Database): void {
  database.exec(SCHEMA);
  runMigrations(database);
}

function openDatabase(): Database.Database {
  const tryOpen = (): Database.Database => {
    const database = new Database(dbPath);
    configureDatabase(database);
    const integrity = database.pragma("integrity_check", {
      simple: true,
    }) as string;
    if (integrity !== "ok") {
      database.close();
      throw new Error(`SQLite integrity check failed: ${integrity}`);
    }
    return database;
  };

  try {
    return tryOpen();
  } catch (err) {
    console.error(
      `SQLite at ${dbPath} is corrupt or unreadable — backing up and reinitializing:`,
      err instanceof Error ? err.message : err,
    );
    backupCorruptDbFiles(
      dbPath,
      err instanceof Error ? err.message : "open failed",
    );
    const database = new Database(dbPath);
    configureDatabase(database);
    return database;
  }
}

export let db = openDatabase();
initializeSchema(db);

let recovering = false;

export function recoverDatabaseFromCorruption(reason: unknown): boolean {
  if (recovering) return false;
  if (!isSqliteCorruptionError(reason)) return false;

  recovering = true;
  try {
    console.error(
      "Recovering SQLite after corruption:",
      reason instanceof Error ? reason.message : reason,
    );
    try {
      db.close();
    } catch {
      // ignore close errors on corrupt handle
    }
    backupCorruptDbFiles(
      dbPath,
      reason instanceof Error ? reason.message : "runtime corruption",
    );
    db = openDatabase();
    initializeSchema(db);
    console.log("SQLite recovery complete — fresh database initialized");
    return true;
  } catch (err) {
    console.error(
      "SQLite recovery failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  } finally {
    recovering = false;
  }
}

export function runDbTask<T>(task: () => T): T {
  try {
    return task();
  } catch (err) {
    if (recoverDatabaseFromCorruption(err)) {
      return task();
    }
    throw err;
  }
}

export function getOrCreateUser(walletAddress: string): UserRow {
  const existing = db
    .prepare("SELECT * FROM users WHERE wallet_address = ?")
    .get(walletAddress) as UserRow | undefined;

  if (existing) return existing;

  db.prepare("INSERT INTO users (wallet_address) VALUES (?)").run(walletAddress);
  return {
    wallet_address: walletAddress,
    balance_lamports: 0,
    total_wagered_lamports: 0,
    total_won_lamports: 0,
    display_name: null,
    email: null,
    auth_provider: "wallet",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function updateBalance(
  walletAddress: string,
  deltaLamports: number,
): number {
  getOrCreateUser(walletAddress);
  db.prepare(
    "UPDATE users SET balance_lamports = balance_lamports + ?, updated_at = datetime('now') WHERE wallet_address = ?",
  ).run(deltaLamports, walletAddress);

  const row = db
    .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
    .get(walletAddress) as { balance_lamports: number };

  return row.balance_lamports;
}

/** Atomically deduct if balance is sufficient; returns new balance or null if insufficient. */
export function deductBalanceIfSufficient(
  walletAddress: string,
  lamports: number,
): number | null {
  getOrCreateUser(walletAddress);
  const result = db
    .prepare(
      `UPDATE users
       SET balance_lamports = balance_lamports - ?, updated_at = datetime('now')
       WHERE wallet_address = ? AND balance_lamports >= ?`,
    )
    .run(lamports, walletAddress, lamports);

  if (result.changes === 0) return null;

  const row = db
    .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
    .get(walletAddress) as { balance_lamports: number };

  return row.balance_lamports;
}

/**
 * Credit a verified deposit exactly once (signature is UNIQUE).
 * Returns null if this signature was already processed.
 */
export function creditDepositOnce(
  walletAddress: string,
  signature: string,
  amountLamports: number,
): { balance: number; alreadyProcessed: boolean } | null {
  getOrCreateUser(walletAddress);
  const depositId = uuidv4();

  const tx = db.transaction(() => {
    const insert = db
      .prepare(
        "INSERT OR IGNORE INTO deposits (id, wallet_address, signature, amount_lamports) VALUES (?, ?, ?, ?)",
      )
      .run(depositId, walletAddress, signature, amountLamports);

    if (insert.changes === 0) {
      const existing = db
        .prepare("SELECT amount_lamports FROM deposits WHERE signature = ?")
        .get(signature) as { amount_lamports: number } | undefined;
      const user = db
        .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
        .get(walletAddress) as { balance_lamports: number };
      return {
        balance: user.balance_lamports,
        alreadyProcessed: true,
        amountLamports: existing?.amount_lamports ?? 0,
      };
    }

    db.prepare(
      "UPDATE users SET balance_lamports = balance_lamports + ?, updated_at = datetime('now') WHERE wallet_address = ?",
    ).run(amountLamports, walletAddress);

    const row = db
      .prepare("SELECT balance_lamports FROM users WHERE wallet_address = ?")
      .get(walletAddress) as { balance_lamports: number };

    return {
      balance: row.balance_lamports,
      alreadyProcessed: false,
      amountLamports,
    };
  });

  return tx();
}

export function recordBet(params: {
  id: string;
  walletAddress: string;
  game: string;
  amountLamports: number;
  payoutLamports: number;
  multiplier?: number;
  result?: string;
  metadata?: Record<string, unknown>;
}): void {
  getOrCreateUser(params.walletAddress);
  db.prepare(
    `INSERT INTO bets (id, wallet_address, game, amount_lamports, payout_lamports, multiplier, result, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.id,
    params.walletAddress,
    params.game,
    params.amountLamports,
    params.payoutLamports,
    params.multiplier ?? null,
    params.result ?? null,
    params.metadata ? JSON.stringify(params.metadata) : null,
  );

  db.prepare(
    "UPDATE users SET total_wagered_lamports = total_wagered_lamports + ?, total_won_lamports = total_won_lamports + ?, updated_at = datetime('now') WHERE wallet_address = ?",
  ).run(params.amountLamports, params.payoutLamports, params.walletAddress);
}
