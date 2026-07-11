import { defineConfig, devices } from "@playwright/test";

const backendBaseUrl = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? backendBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run build -w frontend && npm run dev -w backend",
        url: `${backendBaseUrl}/api/health`,
        reuseExistingServer: true,
        timeout: 300_000,
        env: {
          ...process.env,
          NODE_ENV: "development",
          SERVE_FRONTEND: "true",
          ENABLE_E2E_HELPERS: "true",
        },
      },
});
