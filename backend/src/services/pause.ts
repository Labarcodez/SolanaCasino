import { db } from "../db/index.js";
import { isAnchorEnabled, fetchCasinoAccount } from "./anchor.js";

const PAUSE_KEY = "casino_paused";

export async function isCasinoPaused(): Promise<boolean> {
  if (isAnchorEnabled()) {
    const casino = await fetchCasinoAccount();
    return casino?.isPaused ?? false;
  }

  const row = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(PAUSE_KEY) as { value: string } | undefined;

  return row?.value === "true";
}

export function setLegacyCasinoPaused(paused: boolean): void {
  db.prepare(
    "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(PAUSE_KEY, paused ? "true" : "false");
}
