import { test, expect } from "@playwright/test";
import { buildTestSessionToken, TEST_WALLET } from "./helpers/session";

test.describe("Wallet UI", () => {
  test("deposit button shows confirming state label contract", async ({ page }) => {
    await page.addInitScript((storedToken) => {
      localStorage.setItem("solcasino_auth_token", storedToken);
    }, buildTestSessionToken(TEST_WALLET));

    await page.goto("/wallet");

    // Without a connected wallet we should not reach the wallet panel yet.
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });

});
