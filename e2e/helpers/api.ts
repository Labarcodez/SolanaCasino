const e2ePort = process.env.PLAYWRIGHT_PORT ?? "3098";

/** API target for E2E helpers — always local unless PLAYWRIGHT_API_URL is set explicitly. */
export const API_BASE =
  process.env.PLAYWRIGHT_API_URL ?? `http://127.0.0.1:${e2ePort}`;
