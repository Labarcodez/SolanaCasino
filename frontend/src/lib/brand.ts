/** Central brand configuration — change here to re-skin the entire app. */
export const BRAND = {
  name: "Orbit Solana Casino",
  shortName: "Orbit",
  tagline: "Crash. Limbo. Flip. Win on Solana.",
  description:
    "Non-custodial Solana casino with provably fair crash, limbo, and coinflip. Connect with Phantom, Google, or Apple.",
  domain: "orbit-solana-casino.onrender.com",
  twitter: "@OrbitSolCasino",
  twitterUrl: "https://x.com/OrbitSolCasino",
  discord: "https://discord.gg/orbitcasino",
  docs: "https://docs.orbitcasino.app",
  supportEmail: "support@orbitcasino.app",
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
    rtp: "98%",
    accent: "violet",
    desc: "Set your target multiplier and roll for instant results.",
  },
  {
    id: "coinflip",
    name: "Coinflip",
    shortLabel: "Flip",
    rtp: "95%",
    accent: "gold",
    desc: "Instant 50/50 flips with commit-reveal seeds.",
  },
] as const;

export const TRUST_BADGES = [
  { label: "Provably fair", icon: "shield" },
  { label: "Non-custodial", icon: "wallet" },
  { label: "Mainnet SOL", icon: "chain" },
  { label: "Instant payouts", icon: "bolt" },
] as const;

export const AUTH_MESSAGE_PREFIX = `${BRAND.name} wants you to sign in with your Solana account:`;
