/**
 * Render build entrypoint (Node — avoids Windows CRLF issues in shell scripts).
 */
import { execSync } from "node:child_process";

const env = { ...process.env };

if (env.ALCHEMY_API_KEY && !env.VITE_SOLANA_RPC) {
  const cluster = env.SOLANA_CLUSTER ?? "mainnet-beta";
  const network =
    cluster === "mainnet-beta" || cluster === "mainnet" ? "mainnet" : "devnet";
  env.VITE_SOLANA_RPC = `https://solana-${network}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
}

if (env.CASINO_WALLET_ADDRESS && !env.VITE_CASINO_WALLET) {
  env.VITE_CASINO_WALLET = env.CASINO_WALLET_ADDRESS;
}

const cluster = env.SOLANA_CLUSTER ?? "mainnet-beta";
const isMainnet = cluster === "mainnet-beta" || cluster === "mainnet";

if (isMainnet && !env.ALCHEMY_API_KEY && !env.SOLANA_RPC_URL && !env.HELIUS_RPC_URL) {
  console.warn(
    "\n⚠️  WARNING: ALCHEMY_API_KEY is not set for mainnet build.\n" +
      "   Deposits will fail or hang on the public Solana RPC.\n" +
      "   In Render → Environment, add ALCHEMY_API_KEY from your Alchemy Solana app.\n",
  );
}

if (env.PHANTOM_APP_ID && !env.VITE_PHANTOM_APP_ID) {
  env.VITE_PHANTOM_APP_ID = env.PHANTOM_APP_ID;
}

// Render sets NODE_ENV=production globally, which makes `npm ci` skip devDependencies
// (TypeScript, @types/*, Vite). Force dev deps during the build phase.
const buildEnv = {
  ...env,
  NODE_ENV: "development",
  npm_config_production: "false",
};

execSync("npm ci", { stdio: "inherit", env: buildEnv });
execSync("npm run build:docker", { stdio: "inherit", env: buildEnv });
