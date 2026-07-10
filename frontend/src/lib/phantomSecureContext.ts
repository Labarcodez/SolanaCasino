/** Phantom injects its provider only on HTTPS or localhost (see Phantom FAQ). */
export function isSecurePhantomContext(): boolean {
  if (typeof window === "undefined") return true;
  const { protocol, hostname } = window.location;
  if (protocol === "https:") return true;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function phantomSecureContextHint(): string {
  return "Phantom requires HTTPS (or localhost). This site is served over HTTP, so the extension will not connect. Add a custom domain with SSL to your AWS load balancer, then open the site at https://your-domain.";
}
