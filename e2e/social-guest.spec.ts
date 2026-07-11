import { test, expect } from "@playwright/test";

test.describe("Guest social pages", () => {
  test("shows leaderboard at /leaderboard", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByTestId("leaderboard-panel")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Leaderboard" }),
    ).toBeVisible();
  });

  test("shows tournament at /tournament", async ({ page }) => {
    await page.goto("/tournament");
    await expect(page).toHaveURL(/\/tournament$/);
    await expect(page.getByTestId("tournament-panel")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Weekly Tournament" }),
    ).toBeVisible();
  });

  test("guest nav links to leaderboard and tournament", async ({ page }) => {
    await page.goto("/crash");
    await page.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByTestId("leaderboard-panel")).toBeVisible();

    await page.getByRole("link", { name: "Tournament" }).click();
    await expect(page).toHaveURL(/\/tournament$/);
    await expect(page.getByTestId("tournament-panel")).toBeVisible();
  });
});
