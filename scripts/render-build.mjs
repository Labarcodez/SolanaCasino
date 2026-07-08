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

execSync("npm ci", { stdio: "inherit", env });
execSync("npm run build:docker", { stdio: "inherit", env });
