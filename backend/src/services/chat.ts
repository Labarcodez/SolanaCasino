import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";

const MAX_MESSAGE_LENGTH = 200;
const MAX_STORED_MESSAGES = 200;
const RATE_LIMIT_MS = 2000;

const lastMessageAt = new Map<string, number>();

export interface ChatMessage {
  id: string;
  walletAddress: string;
  message: string;
  createdAt: string;
}

function shortenWallet(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function getRecentChatMessages(limit = 50): ChatMessage[] {
  const rows = db
    .prepare(
      "SELECT id, wallet_address, message, created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?",
    )
    .all(limit) as {
    id: string;
    wallet_address: string;
    message: string;
    created_at: string;
  }[];

  return rows.reverse().map((row) => ({
    id: row.id,
    walletAddress: shortenWallet(row.wallet_address),
    message: row.message,
    createdAt: row.created_at,
  }));
}

export function sendChatMessage(
  walletAddress: string,
  message: string,
): ChatMessage {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} chars)`);
  }

  const now = Date.now();
  const lastAt = lastMessageAt.get(walletAddress) ?? 0;
  if (now - lastAt < RATE_LIMIT_MS) {
    throw new Error("Slow down — wait a moment before sending another message");
  }
  lastMessageAt.set(walletAddress, now);

  const id = uuidv4();
  db.prepare(
    "INSERT INTO chat_messages (id, wallet_address, message) VALUES (?, ?, ?)",
  ).run(id, walletAddress, trimmed);

  const count = db
    .prepare("SELECT COUNT(*) as c FROM chat_messages")
    .get() as { c: number };
  if (count.c > MAX_STORED_MESSAGES) {
    db.prepare(
      `DELETE FROM chat_messages WHERE id IN (
        SELECT id FROM chat_messages ORDER BY created_at ASC LIMIT ?
      )`,
    ).run(count.c - MAX_STORED_MESSAGES);
  }

  return {
    id,
    walletAddress: shortenWallet(walletAddress),
    message: trimmed,
    createdAt: new Date().toISOString(),
  };
}
