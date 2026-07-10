import { test, expect } from "@playwright/test";
import { buildTestSessionToken, TEST_WALLET } from "./helpers/session";

test.describe("Session persistence", () => {
  test("shows welcome back screen when JWT exists but wallet is disconnected", async ({
    page,
  }) => {
    const token = buildTestSessionToken(TEST_WALLET);

    await page.addInitScript((storedToken) => {
      localStorage.setItem("solcasino_auth_token", storedToken);
    }, token);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText(TEST_WALLET.slice(0, 4))).toBeVisible();
  });

  test("keeps wallet tab in the URL after refresh", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page).toHaveURL(/\/wallet$/);

    await page.reload();
    await expect(page).toHaveURL(/\/wallet$/);
  });

  test("landing page loads for new visitors", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Crash. Limbo. Flip.")).toBeVisible();
  });
});
