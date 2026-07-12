import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.PLAYWRIGHT_PORT ?? "3098";
const isSmokeRun =
  process.env.PLAYWRIGHT_SMOKE === "true" ||
  process.argv.some((arg) => arg.includes("smoke-production"));
/** Local E2E always targets the dev server — ignore stale PLAYWRIGHT_BASE_URL from smoke runs. */
const backendBaseUrl = isSmokeRun
  ? (process.env.PLAYWRIGHT_BASE_URL ?? "https://orbit-casino.com")
  : `http://127.0.0.1:${e2ePort}`;
const isRemoteTarget = isSmokeRun;

export default defineConfig({
  testDir: "e2e",
  testIgnore: isSmokeRun ? undefined : ["**/smoke-production.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: backendBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER || isRemoteTarget
      ? undefined
      : {
        command: "npm run build -w frontend && npm run dev -w backend",
        url: `${backendBaseUrl}/api/health`,
        reuseExistingServer: false,
        timeout: 300_000,
        env: {
          PORT: e2ePort,
          NODE_ENV: "development",
          SERVE_FRONTEND: "true",
          ENABLE_E2E_HELPERS: "true",
        },
      },
});
