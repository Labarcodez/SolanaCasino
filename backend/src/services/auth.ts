import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config.js";
import { db } from "../db/index.js";

const JWT_EXPIRY = "7d";

export interface AuthTokenPayload {
  walletAddress: string;
  sub: string;
}

export function buildAuthMessage(walletAddress: string, nonce: string): string {
  const brandName = process.env.BRAND_NAME ?? "OrbitCasino";
  return `${brandName} wants you to sign in with your Solana account:
${walletAddress}

Sign this message to authenticate. This does not initiate a transaction.

Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
}

export function verifyWalletSignature(
  message: string,
  signature: string,
  walletAddress: string,
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );
  } catch {
    return false;
  }
}

export function createSessionToken(walletAddress: string): string {
  return jwt.sign(
    { walletAddress, sub: walletAddress } satisfies AuthTokenPayload,
    config.jwtSecret,
    { expiresIn: JWT_EXPIRY },
  );
}

export function verifySessionToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function createAuthNonce(walletAddress: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare(
    "INSERT OR REPLACE INTO auth_nonces (wallet_address, nonce, expires_at) VALUES (?, ?, ?)",
  ).run(walletAddress, nonce, expiresAt);

  return nonce;
}

export function consumeAuthNonce(
  walletAddress: string,
  nonce: string,
): boolean {
  const row = db
    .prepare(
      "SELECT nonce, expires_at FROM auth_nonces WHERE wallet_address = ?",
    )
    .get(walletAddress) as { nonce: string; expires_at: string } | undefined;

  if (!row || row.nonce !== nonce) return false;

  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM auth_nonces WHERE wallet_address = ?").run(
      walletAddress,
    );
    return false;
  }

  db.prepare("DELETE FROM auth_nonces WHERE wallet_address = ?").run(
    walletAddress,
  );
  return true;
}

export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce: ([a-f0-9]+)/);
  return match?.[1] ?? null;
}
