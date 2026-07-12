/**
 * Security regression tests — balance integrity, crash secrecy, concurrency.
 * Spawns an isolated server with its own SQLite database.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..", "..");
const testDbPath = path.join(os.tmpdir(), `orbitcasino-sec-${Date.now()}.db`);
const testPort = 3101;
const baseUrl = `http://127.0.0.1:${testPort}`;

let serverProc: ChildProcess | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error("Security test server did not become healthy");
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
        JWT_SECRET: "security-test-jwt-secret-32chars-minimum",
        SOLANA_RPC_URL: "https://api.devnet.solana.com",
        SOLANA_CLUSTER: "devnet",
        PROGRAM_AUTHORITY_PRIVATE_KEY: "",
        CASINO_WALLET_PRIVATE_KEY: "",
        SERVE_FRONTEND: "false",
        ENABLE_E2E_HELPERS: "true",
        CRASH_TEST_MAX_CRASH: "1.5",
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

async function authenticate(keypair: Keypair): Promise<{
  token: string;
  wallet: string;
}> {
  const wallet = keypair.publicKey.toBase58();
  const nonceRes = await api<{ nonce: string; message: string }>(
    "POST",
    "/auth/nonce",
    { walletAddress: wallet },
  );
  assert.equal(nonceRes.status, 200);
  const signatureBytes = nacl.sign.detached(
    new TextEncoder().encode(nonceRes.data.message),
    keypair.secretKey,
  );
  const verifyRes = await api<{ token: string }>("POST", "/auth/verify", {
    walletAddress: wallet,
    signature: bs58.encode(signatureBytes),
    message: nonceRes.data.message,
  });
  assert.equal(verifyRes.status, 200);
  return { token: verifyRes.data.token, wallet };
}

async function seedBalance(token: string, amountSol: number): Promise<number> {
  const res = await api<{ balanceSol: number }>(
    "POST",
    "/test/seed-balance",
    { amountSol },
    token,
  );
  assert.equal(res.status, 200);
  return res.data.balanceSol;
}

async function testConcurrentBetsCannotOverdraw(): Promise<void> {
  const keypair = Keypair.generate();
  const { token, wallet } = await authenticate(keypair);
  await seedBalance(token, 0.04);

  const betSol = 0.02;
  const attempts = 4;
  const results = await Promise.all(
    Array.from({ length: attempts }, () =>
      api<{ balanceSol?: number; error?: string }>(
        "POST",
        "/limbo",
        {
          walletAddress: wallet,
          amountSol: betSol,
          targetMultiplier: 1000,
        },
        token,
      ),
    ),
  );

  const successes = results.filter((r) => r.status === 200).length;
  assert.ok(
    successes <= 2,
    `expected at most 2 limbo bets from 0.04 SOL (no wins at 1000x), got ${successes}`,
  );

  const user = await api<{ balanceSol: number }>(
    "GET",
    `/user/${wallet}`,
    undefined,
    token,
  );
  assert.equal(user.status, 200);
  assert.ok(user.data.balanceSol >= 0, "balance must never go negative");
}

async function testCrashPointNotLeakedDuringRound(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket: Socket = io(baseUrl, { transports: ["websocket"] });
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("crash state timeout"));
    }, 60000);

    socket.on("connect", () => {
      socket.emit("crash:subscribe");
    });

    const finish = (crashPoint: number) => {
      assert.ok(crashPoint >= 1, "crashPoint revealed after crash");
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    };

    socket.on("crash:state", (state: { phase: string; crashPoint: number }) => {
      if (state.phase === "betting" || state.phase === "running") {
        assert.equal(
          state.crashPoint,
          0,
          `crashPoint must be hidden during ${state.phase}`,
        );
      }
      if (state.phase === "crashed" || state.phase === "cooldown") {
        finish(state.crashPoint);
      }
    });

    socket.on("crash:crashed", (data: { crashPoint: number }) => {
      finish(data.crashPoint);
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function testCrashRoundApiRedactsIncompleteRound(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket: Socket = io(baseUrl, { transports: ["websocket"] });
    let done = false;
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("round id timeout"));
    }, 15000);

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    };

    socket.on("connect", () => socket.emit("crash:subscribe"));

    socket.on("crash:state", async (state: { id: string; status?: string; phase: string }) => {
      if (!state.id || done) return;

      const round = await api<{
        crashPoint?: number;
        serverSeed?: string;
        status: string;
      }>("GET", `/crash/round/${state.id}`);

      assert.equal(round.status, 200);
      if (round.data.status !== "complete") {
        assert.equal(
          round.data.crashPoint,
          undefined,
          "incomplete round must not expose crashPoint via HTTP",
        );
        assert.equal(
          round.data.serverSeed,
          undefined,
          "incomplete round must not expose serverSeed via HTTP",
        );
      }
      finish();
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function testPauseBlocksLimbo(): Promise<void> {
  const adminWallet = "AdminWallet1111111111111111111111111111111111";
  const player = Keypair.generate();
  const { token, wallet } = await authenticate(player);
  await seedBalance(token, 0.05);

  const adminTokenRes = await api<{ token: string }>("POST", "/test/mint-session", {
    walletAddress: adminWallet,
  });
  assert.equal(adminTokenRes.status, 200);

  const pauseRes = await api<{ success: boolean }>(
    "POST",
    "/admin/pause",
    { paused: true },
    adminTokenRes.data.token,
  );
  assert.equal(pauseRes.status, 200);

  const limboRes = await api<{ error?: string }>(
    "POST",
    "/limbo",
    {
      walletAddress: wallet,
      amountSol: 0.01,
      targetMultiplier: 2,
    },
    token,
  );
  assert.equal(limboRes.status, 503);
  assert.match(limboRes.data.error ?? "", /paused/i);

  await api("POST", "/admin/pause", { paused: false }, adminTokenRes.data.token);
}

async function testAdminUsersRequiresAuth(): Promise<void> {
  const denied = await api<{ error?: string }>("GET", "/admin/users");
  assert.equal(denied.status, 401);

  const player = Keypair.generate();
  const { token } = await authenticate(player);
  const forbidden = await api<{ error?: string }>(
    "GET",
    "/admin/users",
    undefined,
    token,
  );
  assert.equal(forbidden.status, 403);
}

async function testAdminUsersListsBalances(): Promise<void> {
  const adminWallet = "AdminWallet1111111111111111111111111111111111";
  const player = Keypair.generate();
  const { token: playerToken } = await authenticate(player);
  await seedBalance(playerToken, 0.25);

  const adminTokenRes = await api<{ token: string }>("POST", "/test/mint-session", {
    walletAddress: adminWallet,
  });
  assert.equal(adminTokenRes.status, 200);

  const users = await api<{
    users: Array<{ walletAddress: string; balanceSol: number }>;
    total: number;
  }>("GET", "/admin/users", undefined, adminTokenRes.data.token);

  assert.equal(users.status, 200);
  assert.ok(users.data.total >= 1);
  const row = users.data.users.find(
    (u) => u.walletAddress === player.publicKey.toBase58(),
  );
  assert.ok(row, "seeded player should appear in admin user list");
  assert.ok(row.balanceSol >= 0.2);
}

async function testWithdrawRejectedWithoutBalance(): Promise<void> {
  const keypair = Keypair.generate();
  const { token, wallet } = await authenticate(keypair);

  const withdraw = await api<{ error?: string }>(
    "POST",
    "/withdraw",
    { walletAddress: wallet, amountSol: 1 },
    token,
  );
  assert.ok(
    withdraw.status === 400 || withdraw.status === 503,
    `withdraw must fail without balance (got ${withdraw.status})`,
  );

  const user = await api<{ balanceSol: number }>(
    "GET",
    `/user/${wallet}`,
    undefined,
    token,
  );
  assert.equal(user.status, 200);
  assert.equal(user.data.balanceSol, 0);
}

async function testLimboRejectsLowTarget(): Promise<void> {
  const player = Keypair.generate();
  const { token, wallet } = await authenticate(player);
  await seedBalance(token, 0.05);

  const limboRes = await api<{ error?: string }>(
    "POST",
    "/limbo",
    {
      walletAddress: wallet,
      amountSol: 0.01,
      targetMultiplier: 1.01,
    },
    token,
  );
  assert.equal(limboRes.status, 400);
  assert.match(limboRes.data.error ?? "", /2x/i);
}

async function run(): Promise<void> {
  console.log("Security tests — balance integrity & anti-cheat");
  console.log(`DB: ${testDbPath}`);

  await new Promise<void>((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], {
      cwd: backendRoot,
      shell: true,
      stdio: "inherit",
    });
    build.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`build failed: ${code}`)),
    );
  });

  serverProc = await startServer();

  await testConcurrentBetsCannotOverdraw();
  console.log("  ✓ concurrent limbo bets cannot overdraw balance");

  await testCrashPointNotLeakedDuringRound();
  console.log("  ✓ crashPoint hidden until round crashes");

  await testCrashRoundApiRedactsIncompleteRound();
  console.log("  ✓ crash round API redacts incomplete rounds");

  await testPauseBlocksLimbo();
  console.log("  ✓ pause blocks limbo bets");

  await testLimboRejectsLowTarget();
  console.log("  ✓ limbo rejects target below 2x");

  await testAdminUsersRequiresAuth();
  console.log("  ✓ admin user balances require admin auth");

  await testAdminUsersListsBalances();
  console.log("  ✓ admin can list player balances");

  await testWithdrawRejectedWithoutBalance();
  console.log("  ✓ withdraw rejected without balance");

  console.log("\nAll security tests passed.");
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (serverProc) {
      serverProc.kill();
      await sleep(500);
    }
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${testDbPath}${suffix}`;
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* Windows may still hold WAL briefly */
      }
    }
  });
