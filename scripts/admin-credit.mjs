/**
 * Credit a user balance via admin API (custodial ledger restore).
 * Usage:
 *   node scripts/admin-credit.mjs <walletAddress> <amountSol> "<reason>"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return vars;
}

const env = loadEnv(path.join(root, "backend", ".env"));
const apiBase = process.env.API_URL || "https://orbit-casino.com";
const adminWallet = process.env.ADMIN_WALLET || env.ADMIN_WALLET;
const adminPrivateKey =
  process.env.ADMIN_PRIVATE_KEY || env.CASINO_WALLET_PRIVATE_KEY;

const targetWallet = process.argv[2];
const amountSol = Number.parseFloat(process.argv[3] ?? "");
const reason = process.argv[4] ?? "Manual balance restore";

if (!targetWallet || !Number.isFinite(amountSol) || amountSol <= 0) {
  console.error(
    "Usage: node scripts/admin-credit.mjs <walletAddress> <amountSol> \"<reason>\"",
  );
  process.exit(1);
}

if (!adminWallet || !adminPrivateKey) {
  console.error("ADMIN_WALLET and CASINO_WALLET_PRIVATE_KEY required in backend/.env");
  process.exit(1);
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function authAsAdmin() {
  const nonceRes = await fetch(`${apiBase}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: adminWallet }),
  });
  const nonceBody = await readJson(nonceRes);
  if (!nonceRes.ok) throw new Error(nonceBody.error ?? "nonce failed");

  const keypair = Keypair.fromSecretKey(bs58.decode(adminPrivateKey));
  if (keypair.publicKey.toBase58() !== adminWallet) {
    throw new Error("CASINO_WALLET_PRIVATE_KEY does not match ADMIN_WALLET");
  }

  const messageBytes = new TextEncoder().encode(nonceBody.message);
  const signature = bs58.encode(
    nacl.sign.detached(messageBytes, keypair.secretKey),
  );

  const verifyRes = await fetch(`${apiBase}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: adminWallet,
      signature,
      message: nonceBody.message,
      authProvider: "injected",
    }),
  });
  const verifyBody = await readJson(verifyRes);
  if (!verifyRes.ok) throw new Error(verifyBody.error ?? "verify failed");
  return verifyBody.token;
}

const token = await authAsAdmin();
const creditRes = await fetch(
  `${apiBase}/api/admin/users/${targetWallet}/credit`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amountSol, reason }),
  },
);
const creditBody = await readJson(creditRes);
if (!creditRes.ok) {
  console.error("Credit failed:", creditBody);
  process.exit(1);
}

console.log(JSON.stringify(creditBody, null, 2));
