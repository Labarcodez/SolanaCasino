import { db } from "../db/index.js";

export type AuthProviderType = "wallet" | "google" | "apple" | "phantom";

export interface UserProfileRow {
  wallet_address: string;
  balance_lamports: number;
  total_wagered_lamports: number;
  total_won_lamports: number;
  display_name: string | null;
  email: string | null;
  auth_provider: AuthProviderType;
  created_at: string;
  updated_at: string;
}

function ensureProfileColumns(): void {
  const columns = db
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];

  const names = new Set(columns.map((c) => c.name));
  if (!names.has("display_name")) {
    db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  }
  if (!names.has("email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }
  if (!names.has("auth_provider")) {
    db.exec(
      "ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'wallet'",
    );
  }
}

ensureProfileColumns();

export function mapAuthProvider(
  provider?: string,
): AuthProviderType {
  switch (provider) {
    case "google":
      return "google";
    case "apple":
      return "apple";
    case "injected":
      return "wallet";
    case "phantom":
      return "phantom";
    default:
      return "wallet";
  }
}

export function defaultDisplayName(walletAddress: string): string {
  return `Player_${walletAddress.slice(0, 4)}`;
}

export function upsertUserProfile(
  walletAddress: string,
  fields: {
    displayName?: string;
    email?: string;
    authProvider?: AuthProviderType;
  },
): UserProfileRow {
  const existing = db
    .prepare("SELECT * FROM users WHERE wallet_address = ?")
    .get(walletAddress) as UserProfileRow | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO users (wallet_address, display_name, email, auth_provider)
       VALUES (?, ?, ?, ?)`,
    ).run(
      walletAddress,
      fields.displayName ?? defaultDisplayName(walletAddress),
      fields.email ?? null,
      fields.authProvider ?? "wallet",
    );
  } else {
    const displayName = fields.displayName ?? existing.display_name;
    const email =
      fields.email !== undefined ? fields.email : existing.email;
    const authProvider = fields.authProvider ?? existing.auth_provider;

    db.prepare(
      `UPDATE users SET
        display_name = COALESCE(?, display_name),
        email = COALESCE(?, email),
        auth_provider = ?,
        updated_at = datetime('now')
       WHERE wallet_address = ?`,
    ).run(
      displayName,
      email,
      authProvider,
      walletAddress,
    );
  }

  return db
    .prepare("SELECT * FROM users WHERE wallet_address = ?")
    .get(walletAddress) as UserProfileRow;
}

export function updateDisplayName(
  walletAddress: string,
  displayName: string,
): UserProfileRow {
  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 24) {
    throw new Error("Display name must be 2–24 characters");
  }
  if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmed)) {
    throw new Error(
      "Display name can only contain letters, numbers, spaces, _ and -",
    );
  }

  db.prepare(
    "UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE wallet_address = ?",
  ).run(trimmed, walletAddress);

  return db
    .prepare("SELECT * FROM users WHERE wallet_address = ?")
    .get(walletAddress) as UserProfileRow;
}

export function getDisplayName(walletAddress: string): string {
  const row = db
    .prepare("SELECT display_name FROM users WHERE wallet_address = ?")
    .get(walletAddress) as { display_name: string | null } | undefined;

  return row?.display_name ?? defaultDisplayName(walletAddress);
}

export function getPublicProfile(walletAddress: string): {
  walletAddress: string;
  displayName: string;
  authProvider: AuthProviderType;
} {
  const row = db
    .prepare(
      "SELECT wallet_address, display_name, auth_provider FROM users WHERE wallet_address = ?",
    )
    .get(walletAddress) as
    | {
        wallet_address: string;
        display_name: string | null;
        auth_provider: AuthProviderType;
      }
    | undefined;

  if (!row) {
    return {
      walletAddress,
      displayName: defaultDisplayName(walletAddress),
      authProvider: "wallet",
    };
  }

  return {
    walletAddress: row.wallet_address,
    displayName: row.display_name ?? defaultDisplayName(walletAddress),
    authProvider: row.auth_provider,
  };
}
