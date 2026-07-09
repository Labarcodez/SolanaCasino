/**
 * Azure Container Registry build — sets frontend build args (public RPC, not Alchemy).
 */
import { execSync } from "node:child_process";

const env = { ...process.env };

if (env.SOLANA_RPC_FALLBACK && !env.VITE_SOLANA_RPC) {
  env.VITE_SOLANA_RPC = env.SOLANA_RPC_FALLBACK;
} else if (!env.VITE_SOLANA_RPC) {
  const cluster = env.SOLANA_CLUSTER ?? "mainnet-beta";
  env.VITE_SOLANA_RPC =
    cluster === "mainnet-beta" || cluster === "mainnet"
      ? "https://solana.drpc.org"
      : "https://api.devnet.solana.com";
}

if (env.CASINO_WALLET_ADDRESS && !env.VITE_CASINO_WALLET) {
  env.VITE_CASINO_WALLET = env.CASINO_WALLET_ADDRESS;
}

const buildArgs = [
  `VITE_PHANTOM_APP_ID=${env.VITE_PHANTOM_APP_ID ?? env.PHANTOM_APP_ID ?? ""}`,
  `VITE_PROGRAM_ID=${env.VITE_PROGRAM_ID ?? env.PROGRAM_ID ?? "Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU"}`,
  `VITE_CASINO_WALLET=${env.VITE_CASINO_WALLET ?? "C9W7nGv2ZBJp4zcmtvBHkrtTPhB1FQ7JaNNPRNhiA4Ze"}`,
  `VITE_SOLANA_RPC=${env.VITE_SOLANA_RPC}`,
  `VITE_API_URL=${env.VITE_API_URL ?? ""}`,
]
  .map((arg) => `--build-arg ${arg}`)
  .join(" ");

const acrName = process.argv[2];
const imageTag = process.argv[3] ?? "orbit-casino:latest";

if (!acrName) {
  console.error("Usage: node scripts/azure-build.mjs <acrName> [imageTag]");
  process.exit(1);
}

console.log(`Building ${imageTag} in ACR ${acrName}...`);
execSync(`az acr build --registry ${acrName} --image ${imageTag} ${buildArgs} .`, {
  stdio: "inherit",
  env,
});

console.log("ACR build complete.");
