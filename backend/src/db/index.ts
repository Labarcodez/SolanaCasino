import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserRow } from "./types.js";
import "./migrations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "data");
const dbPath = path.join(dataDir, "casino.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
`);

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
