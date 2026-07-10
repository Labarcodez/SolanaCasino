let activeCluster = "devnet";
let activeRpc =
  import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export function setSolanaCluster(cluster: string): void {
  activeCluster = cluster;
}

export function getSolanaCluster(): string {
  return activeCluster;
}

export function setSolanaRpc(rpcUrl: string): void {
  if (rpcUrl && isBrowserSafeRpcImport(rpcUrl)) {
    activeRpc = rpcUrl;
  }
}

function isBrowserSafeRpcImport(url: string): boolean {
  const lower = url.toLowerCase();
  return !lower.includes("alchemy.com") && !lower.includes("helius-rpc.com");
}

export function getSolanaRpc(): string {
  return activeRpc;
}

export function isMainnetCluster(cluster = activeCluster): boolean {
  return cluster === "mainnet-beta" || cluster === "mainnet";
}
