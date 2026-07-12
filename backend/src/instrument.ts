/**
 * Sentry must load before other app modules (see Sentry ESM docs).
 * No-op when SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.15 : 1.0,
    ignoreErrors: ["Casino is paused", "Betting temporarily paused"],
  });
}

export { Sentry };
