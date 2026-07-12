import { test, expect } from "@playwright/test";

/**
 * Post-deploy smoke against a live deployment.
 * Run: PLAYWRIGHT_BASE_URL=https://orbit-casino.com PLAYWRIGHT_SKIP_WEBSERVER=true npm run test:e2e:smoke
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://orbit-casino.com";

test.describe("Production smoke", () => {
  test("API health returns ok", async ({ request }) => {
    const res = await request.get(`${baseURL}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toMatch(/ok|degraded/);
  });

  test("API config exposes limbo min target >= 1.25", async ({ request }) => {
    const res = await request.get(`${baseURL}/api/config`);
    expect(res.ok()).toBeTruthy();
    const config = await res.json();
    expect(config.limboMinTarget).toBeGreaterThanOrEqual(1.25);
    expect(config.minBetSol).toBeGreaterThan(0);
  });

  test("crash page loads for guests", async ({ page }) => {
    await page.goto(`${baseURL}/crash`);
    await expect(page.getByText("Spectator mode")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("crash-phase-badge")).toBeVisible();
  });

  test("limbo page loads for guests", async ({ page }) => {
    await page.goto(`${baseURL}/limbo`);
    await expect(page.getByRole("heading", { name: "Limbo", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("limbo-spectator-connect")).toBeVisible();
  });

  test("og-image.png is served", async ({ request }) => {
    const res = await request.get(`${baseURL}/og-image.png`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"] ?? "").toMatch(/image\/png/i);
  });

  test("/verify opens fairness panel", async ({ page }) => {
    await page.goto(`${baseURL}/verify`);
    await expect(page.getByRole("heading", { name: /fairness|provably/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
