import { BRAND } from "./brand";

/** Phantom in-app browser injects the same provider as the extension. */
export function isPhantomInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /Phantom/i.test(ua) || Boolean(
    (window as Window & { phantom?: { solana?: { isPhantom?: boolean } } })
      .phantom?.solana?.isPhantom,
  );
}

/** Opens the site inside Phantom's in-app browser (injected provider available there). */
export function getPhantomBrowseUrl(
  targetUrl?: string,
  refUrl?: string,
): string {
  const page = targetUrl ?? window.location.href;
  const ref = refUrl ?? window.location.origin;
  return `https://phantom.app/ul/browse/${encodeURIComponent(page)}?ref=${encodeURIComponent(ref)}`;
}

export function phantomBrowseHint(): string {
  return `Open ${BRAND.shortName} inside the Phantom app, then tap Connect — your wallet works in Phantom's built-in browser.`;
}
