/**
 * Build and push Orbit Docker image to Amazon ECR.
 *
 * Usage: node scripts/aws-build.mjs <ecr-repository-uri> [image-tag]
 * Example: node scripts/aws-build.mjs 123456789012.dkr.ecr.us-east-2.amazonaws.com/orbit-casino latest
 */
import { execSync } from "node:child_process";

const ecrUri = process.argv[2];
const imageTag = process.argv[3] ?? "latest";

if (!ecrUri) {
  console.error("Usage: node scripts/aws-build.mjs <ecr-repository-uri> [image-tag]");
  process.exit(1);
}

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

const regionMatch = ecrUri.match(/\.dkr\.ecr\.([^.]+)\.amazonaws\.com/);
const region = regionMatch?.[1] ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "us-east-2";

const buildArgs = [
  `VITE_PHANTOM_APP_ID=${env.VITE_PHANTOM_APP_ID ?? env.PHANTOM_APP_ID ?? ""}`,
  `VITE_PROGRAM_ID=${env.VITE_PROGRAM_ID ?? env.PROGRAM_ID ?? "Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU"}`,
  `VITE_CASINO_WALLET=${env.VITE_CASINO_WALLET ?? "3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu"}`,
  `VITE_SOLANA_RPC=${env.VITE_SOLANA_RPC}`,
  `VITE_API_URL=${env.VITE_API_URL ?? ""}`,
  `VITE_SENTRY_DSN=${env.VITE_SENTRY_DSN ?? ""}`,
]
  .map((arg) => `--build-arg ${arg}`)
  .join(" ");

const imageRef = `${ecrUri}:${imageTag}`;

console.log(`Logging in to ECR (${region})...`);
execSync(
  `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${ecrUri.split("/")[0]}`,
  { stdio: "inherit", shell: true, env },
);

console.log(`Building ${imageRef}...`);
execSync(`docker build ${buildArgs} -t ${imageRef} .`, {
  stdio: "inherit",
  env,
});

console.log(`Pushing ${imageRef}...`);
execSync(`docker push ${imageRef}`, { stdio: "inherit", env });

console.log("ECR push complete.");
