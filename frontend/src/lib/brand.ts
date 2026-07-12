/** Central brand configuration — change here to re-skin the entire app. */
export const BRAND = {
  name: "Orbit Solana Casino",
  shortName: "Orbit",
  tagline: "Crash. Limbo. Flip. Win on Solana.",
  description:
    "Deposit-first Solana casino with provably fair crash, limbo, and coinflip. Connect with Phantom, Google, or Apple.",
  domain: "orbit-casino.com",
  twitter: "@OrbitSolCasino",
  twitterUrl: "https://x.com/OrbitSolCasino",
  discord: "https://discord.gg/tXHWmuQkS",
  docs: "https://docs.orbitcasino.app",
  supportEmail: "orbitsolanacasino@gmail.com",
  rtp: "95%",
  minBet: "0.001 SOL",
} as const;

export const GAMES = [
  {
    id: "crash",
    name: "Crash",
    shortLabel: "Crash",
    rtp: "95%",
    accent: "green",
    desc: "Ride the multiplier curve. Cash out before the bust.",
  },
  {
    id: "limbo",
    name: "Limbo",
    shortLabel: "Limbo",
    rtp: "95%",
    accent: "violet",
    desc: "Set your target (2× min) and roll for instant results.",
  },
  {
    id: "coinflip",
    name: "Coinflip",
    shortLabel: "Flip",
    rtp: "94%",
    accent: "gold",
    desc: "Instant 50/50 flips with commit-reveal seeds.",
  },
] as const;

export const TRUST_BADGES = [
  { label: "Provably fair", icon: "shield" },
  { label: "Deposit-first", icon: "wallet" },
  { label: "Mainnet SOL", icon: "chain" },
  { label: "Fast withdrawals", icon: "bolt" },
] as const;

export function getTrustBadges(options: {
  cluster?: string;
  withdrawalsEnabled?: boolean;
  onChainEnabled?: boolean;
}): { label: string; icon: string }[] {
  const isMainnet = options.cluster === "mainnet-beta";
  const solLabel = isMainnet ? "Mainnet SOL" : "Devnet SOL";
  const payoutLabel = options.withdrawalsEnabled
    ? "Fast withdrawals"
    : "Queued withdrawals";

  return [
    { label: "Provably fair", icon: "shield" },
    { label: "Deposit-first", icon: "wallet" },
    { label: solLabel, icon: "chain" },
    { label: payoutLabel, icon: "bolt" },
  ];
}

export function getClusterLabel(cluster?: string): string {
  if (cluster === "mainnet-beta") return "Mainnet";
  if (cluster === "devnet") return "Devnet";
  return cluster ?? "Solana";
}

export const AUTH_MESSAGE_PREFIX = `${BRAND.name} wants you to sign in with your Solana account:`;
