/** Central brand configuration — change here to re-skin the entire app. */
export const BRAND = {
  name: "OrbitCasino",
  shortName: "Orbit",
  tagline: "Crash. Flip. Win on Solana.",
  description:
    "Non-custodial Solana casino with provably fair crash and coinflip. Connect with Phantom, Google, or Apple.",
  domain: "orbitcasino.app",
  twitter: "@OrbitCasino",
  discord: "https://discord.gg/orbitcasino",
  docs: "https://docs.orbitcasino.app",
  supportEmail: "support@orbitcasino.app",
  rtp: "95%",
  minBet: "0.001 SOL",
} as const;

export const AUTH_MESSAGE_PREFIX = `${BRAND.name} wants you to sign in with your Solana account:`;
