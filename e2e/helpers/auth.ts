import type { APIRequestContext } from "@playwright/test";

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001";

export const TEST_E2E_WALLET =
  "HEqvDJ1111111111111111111111111111116fq6";

export interface AuthenticatedTestUser {
  wallet: string;
  token: string;
}

export async function createTestSession(
  request: APIRequestContext,
  walletAddress = TEST_E2E_WALLET,
): Promise<AuthenticatedTestUser> {
  const res = await request.post(`${API_BASE}/api/test/mint-session`, {
    data: { walletAddress },
  });
  if (!res.ok()) {
    throw new Error(`Mint session failed: ${res.status()}`);
  }
  const { token, walletAddress: wallet } = (await res.json()) as {
    token: string;
    walletAddress: string;
  };
  return { wallet, token };
}

export async function seedTestBalance(
  request: APIRequestContext,
  token: string,
  amountSol = 0.1,
): Promise<number> {
  const res = await request.post(`${API_BASE}/api/test/seed-balance`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amountSol },
  });
  if (!res.ok()) {
    throw new Error(`Seed balance failed: ${res.status()}`);
  }
  const { balanceSol } = (await res.json()) as { balanceSol: number };
  return balanceSol;
}
