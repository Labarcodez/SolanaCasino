let activeCluster = "devnet";

export function setSolanaCluster(cluster: string): void {
  activeCluster = cluster;
}

export function getSolanaCluster(): string {
  return activeCluster;
}

export function isMainnetCluster(cluster = activeCluster): boolean {
  return cluster === "mainnet-beta" || cluster === "mainnet";
}
