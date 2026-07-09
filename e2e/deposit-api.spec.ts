import { test, expect } from "@playwright/test";

test.describe("Deposit API", () => {
  test("rejects deposit verification without authentication", async ({ request }) => {
    const res = await request.post("http://127.0.0.1:3001/api/deposit/verify", {
      data: {
        signature: "5".repeat(88),
        walletAddress: "HEqvDJ1111111111111111111111111111116fq6",
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/authentication/i);
  });

  test("health endpoint reports RPC status", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3001/api/health");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("rpc");
  });

  test("config exposes casino wallet for deposits", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:3001/api/config");
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.casinoWallet).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(body.minBetSol).toBeGreaterThan(0);
  });
});
