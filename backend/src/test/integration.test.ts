/**
 * Production-readiness integration tests.
 * Spawns a real server on a test port with an isolated SQLite database.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { io, type Socket } from "socket.io-client";
import {
  generateCrashPoint,
  generateServerSeed,
  hashServerSeed,
  generateCoinflipResult,
  evaluateLimboBet,
  LIMBO_HOUSE_EDGE,
} from "../services/provablyFair.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..", "..");
const testDbPath = path.join(os.tmpdir(), `orbitcasino-integ-${Date.now()}.db`);
const testPort = 3099;
const baseUrl = `http://127.0.0.1:${testPort}`;

let serverProc: ChildProcess | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error("Server did not become healthy in time");
}

function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["dist/index.js"], {
      cwd: backendRoot,
      env: {
        ...process.env,
        PORT: String(testPort),
        NODE_ENV: "development",
        SQLITE_PATH: testDbPath,
        JWT_SECRET: "integration-test-jwt-secret-32chars-min",
        SOLANA_RPC_URL: "https://api.devnet.solana.com",
        SOLANA_CLUSTER: "devnet",
        PROGRAM_AUTHORITY_PRIVATE_KEY: "",
        CASINO_WALLET_PRIVATE_KEY: "",
        SERVE_FRONTEND: "false",
        FRONTEND_URL: "http://localhost:5173",
        ADMIN_WALLET: "AdminWallet1111111111111111111111111111111111",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("error", reject);

    waitForHealth()
      .then(() => resolve(proc))
      .catch((err) => {
        proc.kill();
        reject(new Error(`${err.message}\n${stderr}`));
      });
  });
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

async function authenticateTestUser(
  keypair: Keypair,
): Promise<{ token: string; wallet: string }> {
  const wallet = keypair.publicKey.toBase58();

  const nonceRes = await api<{ nonce: string; message: string }>("POST", "/auth/nonce", {
    walletAddress: wallet,
  });
  assert.equal(nonceRes.status, 200);
  const { message } = nonceRes.data;

  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = bs58.encode(signatureBytes);

  const verifyRes = await api<{ token: string }>("POST", "/auth/verify", {
    walletAddress: wallet,
    signature,
    message,
    displayName: "TestPlayer",
  });
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.data.token);

  return { token: verifyRes.data.token, wallet };
}

async function testPublicEndpoints(): Promise<void> {
  const health = await api<{ status: string }>("GET", "/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.status, "ok");

  const config = await api<{
    onChainEnabled: boolean;
    cluster: string;
    minBetSol: number;
  }>("GET", "/config");
  assert.equal(config.status, 200);
  assert.equal(config.data.onChainEnabled, false);
  assert.equal(config.data.cluster, "devnet");
  assert.ok(config.data.minBetSol > 0);

  const stats = await api<{ totalUsers: number }>("GET", "/casino/stats");
  assert.equal(stats.status, 200);

  const leaderboard = await api<unknown[]>("GET", "/leaderboard");
  assert.equal(leaderboard.status, 200);
  assert.ok(Array.isArray(leaderboard.data));

  const wins = await api<unknown[]>("GET", "/recent-wins");
  assert.equal(wins.status, 200);
  assert.ok(Array.isArray(wins.data));

  const tournament = await api<{ prizePoolSol: number }>("GET", "/tournament");
  assert.equal(tournament.status, 200);
}

async function testFairnessEndpoints(): Promise<void> {
  const serverSeed = generateServerSeed();
  const roundId = "integ-round";
  const crashPoint = generateCrashPoint(serverSeed, roundId, []);
  const hash = hashServerSeed(serverSeed);

  const crash = await api<{ valid: boolean }>("POST", "/fairness/verify-crash", {
    serverSeed,
    serverSeedHash: hash,
    roundId,
    clientSeeds: [],
    crashPoint,
  });
  assert.equal(crash.status, 200);
  assert.equal(crash.data.valid, true);

  const betId = "integ-bet";
  const clientSeed = "test-seed";
  const flip = generateCoinflipResult(serverSeed, betId, clientSeed);
  const coinflip = await api<{ valid: boolean }>("POST", "/fairness/verify-coinflip", {
    serverSeed,
    betId,
    clientSeed,
    expectedResult: flip,
  });
  assert.equal(coinflip.status, 200);
  assert.equal(coinflip.data.valid, true);

  const limbo = evaluateLimboBet({
    serverSeed,
    betId,
    clientSeed,
    targetMultiplier: 2,
    houseEdge: LIMBO_HOUSE_EDGE,
  });
  const limboRes = await api<{ valid: boolean }>("POST", "/fairness/verify-limbo", {
    serverSeed,
    betId,
    clientSeed,
    targetMultiplier: 2,
    expectedWon: limbo.won,
  });
  assert.equal(limboRes.status, 200);
  assert.equal(limboRes.data.valid, true);
}

async function testAuthAndGames(): Promise<{ token: string; wallet: string }> {
  const keypair = Keypair.generate();
  const { token, wallet } = await authenticateTestUser(keypair);

  // Seed balance directly (custodial test path)
  process.env.SQLITE_PATH = testDbPath;
  const { updateBalance } = await import("../db/index.js");
  updateBalance(wallet, 100_000_000); // 0.1 SOL

  const user = await api<{ balanceSol: number; displayName: string }>(
    "GET",
    `/user/${wallet}`,
    undefined,
    token,
  );
  assert.equal(user.status, 200);
  assert.ok(user.data.balanceSol >= 0.09);
  assert.equal(user.data.displayName, "TestPlayer");

  const profile = await api<{ displayName: string }>(
    "PATCH",
    "/profile",
    { displayName: "OrbitTester" },
    token,
  );
  assert.equal(profile.status, 200);
  assert.equal(profile.data.displayName, "OrbitTester");

  const coinflip = await api<{
    won: boolean;
    balanceSol: number;
    result: string;
  }>("POST", "/coinflip", {
    walletAddress: wallet,
    amountSol: 0.001,
    choice: "heads",
    clientSeed: "flip-seed",
  }, token);
  assert.equal(coinflip.status, 200);
  assert.ok(coinflip.data.result === "heads" || coinflip.data.result === "tails");
  assert.ok(coinflip.data.balanceSol >= 0);

  const limbo = await api<{
    won: boolean;
    balanceSol: number;
    roll: number;
  }>("POST", "/limbo", {
    walletAddress: wallet,
    amountSol: 0.001,
    targetMultiplier: 2,
    clientSeed: "limbo-seed",
  }, token);
  assert.equal(limbo.status, 200);
  assert.ok(typeof limbo.data.roll === "number");

  const withdraw = await api<{ error?: string; withdrawalsEnabled?: boolean }>(
    "POST",
    "/withdraw",
    { walletAddress: wallet, amountSol: 0.01 },
    token,
  );
  assert.equal(withdraw.status, 503);
  assert.equal(withdraw.data.withdrawalsEnabled, false);
  assert.ok(withdraw.data.error?.includes("CASINO_WALLET_PRIVATE_KEY"));

  const history = await api<unknown[]>("GET", `/history/${wallet}`, undefined, token);
  assert.equal(history.status, 200);
  assert.ok(Array.isArray(history.data));
  assert.ok(history.data.length >= 2);

  const admin = await fetch(`${baseUrl}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(admin.status, 403);

  const badAuth = await api<{ error: string }>("GET", `/user/${wallet}`);
  assert.equal(badAuth.status, 401);

  return { token, wallet };
}

async function testWebSocket(token: string, wallet: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket: Socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      timeout: 8000,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("WebSocket test timed out"));
    }, 12000);

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(err);
    });

    socket.on("connect", () => {
      socket.emit("crash:subscribe");
    });

    socket.on("crash:state", (state: { phase?: string }) => {
      if (state?.phase) {
        clearTimeout(timeout);
        socket.disconnect();
        resolve();
      }
    });

    socket.on("chat:history", (msgs: unknown[]) => {
      assert.ok(Array.isArray(msgs));
    });
  });

  await new Promise<void>((resolve, reject) => {
    const socket: Socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      timeout: 8000,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Crash bet test timed out"));
    }, 15000);

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on("connect", () => {
      socket.emit(
        "crash:bet",
        { amountSol: 0.001, autoCashout: 1.5 },
        (response: { success?: boolean; error?: string }) => {
          clearTimeout(timeout);
          socket.disconnect();
          if (response?.success) {
            resolve();
          } else {
            reject(new Error(response?.error ?? "Crash bet failed"));
          }
        },
      );
    });
  });
}

async function run(): Promise<void> {
  console.log("🧪 OrbitCasino integration tests");
  console.log(`   DB: ${testDbPath}`);
  console.log(`   Port: ${testPort}`);

  serverProc = await startServer();
  console.log("✅ Server started");

  await testPublicEndpoints();
  console.log("✅ Public API endpoints");

  await testFairnessEndpoints();
  console.log("✅ Fairness verification");

  const { token, wallet } = await testAuthAndGames();
  console.log("✅ Auth, profile, coinflip, limbo, withdraw, history");

  await testWebSocket(token, wallet);
  console.log("✅ WebSocket crash subscribe + bet");

  console.log("");
  console.log("✅ All integration tests passed");
}

run()
  .catch((err) => {
    console.error("❌ Integration test failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (serverProc) {
      serverProc.kill("SIGTERM");
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Windows may keep the SQLite file locked briefly after shutdown.
      }
    }
  });
