import { test, expect } from "@playwright/test";
import { API_BASE } from "./helpers/api";

const TREASURY_WALLET = "3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu";

test.describe("Orbit Token — Pump.fun coming soon", () => {
  test("token API reports coming soon on Pump.fun", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/token/orbit`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      launchStatus: string;
      launchPlatform: string;
      treasuryWallet: string;
      mint: string | null;
    };
    expect(body.launchStatus).toBe("coming_soon");
    expect(body.launchPlatform).toBe("pump");
    expect(body.treasuryWallet).toBe(TREASURY_WALLET);
    expect(body.mint).toBeNull();
  });

  test("health reports persistent SQLite on EFS path in production-like env", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      persistence?: { dbPath: string; dbExists: boolean };
      sqliteStorage?: string;
    };
    if (body.persistence) {
      expect(body.persistence.dbPath).toContain("casino.db");
      expect(body.persistence.dbExists).toBe(true);
    } else {
      expect(body.sqliteStorage).toBe("efs");
    }
  });

  test("shows Pump.fun coming soon page without buy button", async ({ page }) => {
    await page.goto("/token");
    await expect(page).toHaveURL(/\/token$/);
    await expect(page.getByTestId("token-coming-soon")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("token-coming-soon").getByText("Launching soon", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("token-pump-fm-link")).toBeVisible();
    await expect(page.getByTestId("token-website-link")).toHaveAttribute(
      "href",
      "https://orbit-casino.com",
    );
    await expect(page.getByTestId("token-x-link")).toHaveAttribute(
      "href",
      /x\.com\/OrbitSolCasino/,
    );
    await expect(
      page.getByTestId("token-coming-soon").getByText(TREASURY_WALLET).first(),
    ).toBeVisible();
    await expect(page.getByTestId("token-pump-fm-link")).toHaveAttribute(
      "href",
      "https://pump.fun",
    );
    await expect(page.getByRole("link", { name: "Buy token" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Buy on Pump.fun" })).toHaveCount(0);
  });
});
