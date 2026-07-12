import { test, expect } from "@playwright/test";

test.describe("Crash jackpot", () => {
  test("jackpot API returns pool state", async ({ request }) => {
    const res = await request.get("/api/jackpot");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      poolSol: number;
      contributionBps: number;
      minCrashMultiplier: number;
    };
    expect(typeof body.poolSol).toBe("number");
    expect(body.contributionBps).toBe(50);
    expect(body.minCrashMultiplier).toBe(2);
  });

  test("shows jackpot banner on crash page", async ({ page }) => {
    await page.goto("/crash");
    await expect(page.getByTestId("crash-jackpot-banner")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Crash Jackpot")).toBeVisible();
  });
});
