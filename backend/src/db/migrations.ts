import type Database from "better-sqlite3";

export function runMigrations(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  const userCols = new Set(columns.map((c) => c.name));

  if (!userCols.has("referral_code")) {
    database.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
    database.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)",
    );
  }
  if (!userCols.has("referred_by")) {
    database.exec("ALTER TABLE users ADD COLUMN referred_by TEXT");
  }
  if (!userCols.has("rakeback_pending_lamports")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN rakeback_pending_lamports INTEGER NOT NULL DEFAULT 0",
    );
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS pending_game_prepares (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      game TEXT NOT NULL,
      server_seed_hash TEXT NOT NULL,
      server_seed TEXT NOT NULL,
      client_seed TEXT NOT NULL,
      metadata TEXT,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_prepares_wallet ON pending_game_prepares(wallet_address);

    CREATE TABLE IF NOT EXISTS affiliate_earnings (
      id TEXT PRIMARY KEY,
      referrer_wallet TEXT NOT NULL,
      referred_wallet TEXT NOT NULL,
      bet_id TEXT NOT NULL,
      house_edge_lamports INTEGER NOT NULL,
      commission_lamports INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_affiliate_referrer ON affiliate_earnings(referrer_wallet);

    CREATE TABLE IF NOT EXISTS rakeback_claims (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      amount_lamports INTEGER NOT NULL,
      vip_tier TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tournament_weeks (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      prize_pool_lamports INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS tournament_entries (
      week_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      wagered_lamports INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (week_id, wallet_address)
    );

    CREATE TABLE IF NOT EXISTS affiliate_claims (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      amount_lamports INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tournament_payouts (
      id TEXT PRIMARY KEY,
      week_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_lamports INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jackpot_contributions (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      bet_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_lamports INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jackpot_contributions_round
      ON jackpot_contributions(round_id);

    CREATE TABLE IF NOT EXISTS jackpot_payouts (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_lamports INTEGER NOT NULL,
      cashout_multiplier REAL NOT NULL,
      crash_point REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jackpot_payouts_created
      ON jackpot_payouts(created_at DESC);

    CREATE TABLE IF NOT EXISTS balance_adjustments (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      delta_lamports INTEGER NOT NULL,
      reason TEXT NOT NULL,
      admin_wallet TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_balance_adjustments_wallet
      ON balance_adjustments(wallet_address);

    CREATE TABLE IF NOT EXISTS token_reward_distributions (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      winner_wallet TEXT NOT NULL,
      claimed_lamports INTEGER NOT NULL,
      winner_lamports INTEGER NOT NULL,
      treasury_lamports INTEGER NOT NULL,
      claim_signature TEXT NOT NULL,
      payout_signature TEXT,
      holder_balance TEXT NOT NULL DEFAULT '0',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_token_rewards_created
      ON token_reward_distributions(created_at DESC);
  `);
}
