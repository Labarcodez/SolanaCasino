import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserRow } from "./types.js";
import { runMigrations } from "./migrations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.SQLITE_PATH
  ? path.dirname(path.resolve(process.env.SQLITE_PATH))
  : path.join(__dirname, "..", "..", "data");
const dbPath = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(dataDir, "casino.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

function backupCorruptDbFiles(targetPath: string): void {
  const stamp = Date.now();
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${targetPath}${suffix}`;
    if (fs.existsSync(file)) {
      fs.renameSync(file, `${file}.corrupt-${stamp}`);
    }
  }
}

function openDatabase(): Database.Database {
  const tryOpen = (): Database.Database => {
    const database = new Database(dbPath);
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
    backupCorruptDbFiles(dbPath);
    return new Database(dbPath);
  }
}

export const db = openDatabase();

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(SCHEMA);
runMigrations();

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
