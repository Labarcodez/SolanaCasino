import { test, expect } from "@playwright/test";

test.describe("Clean URL routing", () => {
  test("serves crash game at /crash for guests", async ({ page }) => {
    await page.goto("/crash");
    await expect(page).toHaveURL(/\/crash$/);
    await expect(page.getByText("Spectator mode")).toBeVisible();
    await expect(page.getByTestId("crash-phase-badge")).toBeVisible();
  });

  test("serves limbo preview at /limbo for guests", async ({ page }) => {
    await page.goto("/limbo");
    await expect(page).toHaveURL(/\/limbo$/);
    await expect(page.getByRole("heading", { name: "Limbo", exact: true })).toBeVisible();
    await expect(page.getByText("Connect your wallet to play limbo")).toBeVisible();
  });

  test("serves coinflip preview at /coinflip for guests", async ({ page }) => {
    await page.goto("/coinflip");
    await expect(page).toHaveURL(/\/coinflip$/);
    await expect(page.getByRole("heading", { name: "Coinflip", exact: true })).toBeVisible();
  });

  test("redirects legacy ?tab=wallet to /wallet", async ({ page }) => {
    await page.goto("/?tab=wallet");
    await expect(page).toHaveURL(/\/wallet$/);
  });

  test("redirects legacy ?tab=limbo to /limbo", async ({ page }) => {
    await page.goto("/?tab=limbo");
    await expect(page).toHaveURL(/\/limbo$/);
  });

  test("keeps /wallet after refresh", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page).toHaveURL(/\/wallet$/);
    await page.reload();
    await expect(page).toHaveURL(/\/wallet$/);
  });
});

test.describe("Guest crash spectator", () => {
  test("shows connect banner and disabled betting", async ({ page }) => {
    await page.goto("/crash");
    await expect(page.getByTestId("spectator-connect-banner")).toBeVisible();
    await expect(page.getByTestId("crash-place-bet-0")).toBeDisabled();
    await expect(page.getByTestId("crash-cashout-0")).toBeDisabled();
  });

  test("receives live crash phase updates", async ({ page }) => {
    await page.goto("/crash");
    const badge = page.getByTestId("crash-phase-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/betting|running|crashed|cooldown/);
  });

  test("opens in-game fairness modal", async ({ page }) => {
    await page.goto("/crash");
    await page.getByTestId("crash-fairness-button").click();
    await expect(
      page.getByRole("dialog", { name: "Provably fair verification" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify Crash" })).toBeVisible();
    await page.getByRole("button", { name: "Close fairness modal" }).click();
    await expect(
      page.getByRole("dialog", { name: "Provably fair verification" }),
    ).not.toBeVisible();
  });

  test("focus mode hides side panels", async ({ page }) => {
    await page.goto("/crash");
    const arena = page.locator(".crash-arena");
    await page.getByTestId("crash-focus-toggle").click();
    await expect(arena).toHaveClass(/crash-arena--focus/);
  });
});

test.describe("Fairness deep links", () => {
  test("opens fairness panel from /fairness route", async ({ page }) => {
    await page.goto("/fairness?verify=limbo");
    await expect(page.getByRole("button", { name: "Verify Limbo" })).toBeVisible();
  });

  test("opens fairness panel from /verify route", async ({ page }) => {
    await page.goto("/verify?verify=crash");
    await expect(page.getByRole("button", { name: "Verify Crash" })).toBeVisible();
  });
});
