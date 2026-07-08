import { PHANTOM_APP_ID } from "./api";

/** Auth providers supported by @phantom/react-sdk / @phantom/browser-sdk */
export type PhantomAuthProvider =
  | "google"
  | "apple"
  | "phantom"
  | "injected"
  | "deeplink";

/** Extension-only when Portal app ID is missing; full set when configured. */
export function getPhantomProviders(): PhantomAuthProvider[] {
  if (!PHANTOM_APP_ID) {
    return ["injected"];
  }
  return ["injected", "deeplink", "google", "apple", "phantom"];
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isPortalConfigured(): boolean {
  return Boolean(PHANTOM_APP_ID);
}
