import { test, expect } from "@playwright/test";
import { createTestSession, seedTestBalance } from "./helpers/auth";
import { primeAuthenticatedSession } from "./helpers/phantom";

function uniqueTestWallet(label: string): string {
  const slug = label.replace(/\W/g, "").slice(0, 8);
  const stamp = Date.now().toString(36);
  return `HEqvDJ${slug}${stamp}11111111111111116fq6`.slice(0, 44);
}

test.describe("Authenticated gameplay", () => {
  test.describe.configure({ mode: "serial" });

  test("shows balance and enabled crash betting with seeded funds", async ({
    page,
    request,
  }) => {
    const wallet = uniqueTestWallet("crash");
    const { token } = await createTestSession(request, wallet);
    await seedTestBalance(request, token, 0.1);
    await primeAuthenticatedSession(page, wallet, token);

    await page.goto("/crash");

    await expect(page.getByTitle("Open wallet")).toBeVisible({ timeout: 20_000 });
    const betButton = page.getByTestId("crash-place-bet-0");
    await expect(betButton).toBeVisible({ timeout: 20_000 });
    await expect(betButton).toBeEnabled();
    await expect(page.getByTestId("crash-auto-bet")).toBeVisible();
  });

  test("shows transaction history on wallet page", async ({ page, request }) => {
    const wallet = uniqueTestWallet("wallet");
    const { token } = await createTestSession(request, wallet);
    await seedTestBalance(request, token, 0.05);
    await primeAuthenticatedSession(page, wallet, token);

    await page.goto("/crash");
    await expect(page.getByTitle("Open wallet")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Wallet" }).click();
    await expect(page).toHaveURL(/\/wallet$/);

    await expect(page.getByTestId("transaction-history-panel")).toBeVisible();
    await expect(page.getByText("Transaction history")).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Deposits" })).toBeVisible();
  });
});
