/**
 * Launch ORBIT on Bags.fm (Token Launch v2).
 *
 * Prerequisites (backend/.env):
 *   BAGS_FM_API_KEY, CASINO_WALLET_PRIVATE_KEY, ALCHEMY_API_KEY or SOLANA_RPC_URL
 *
 * Usage:
 *   npx tsx scripts/launch-orbit-bags.ts              # dry-run (prints plan)
 *   npx tsx scripts/launch-orbit-bags.ts --confirm    # executes on-chain launch
 *
 * @see https://docs.bags.fm/how-to-guides/launch-token
 * @see https://docs.bags.fm/how-to-guides/customize-token-fees
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bs58 from "bs58";
import {
  BagsSDK,
  createTipTransaction,
  sendBundleAndConfirm,
  signAndSendTransaction,
  waitForSlotsToPass,
  BAGS_FEE_SHARE_V2_MAX_CLAIMERS_NON_LUT,
} from "@bagsfm/bags-sdk";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";

loadEnv({ path: resolve(process.cwd(), "backend/.env"), quiet: true });

interface OrbitTokenCopy {
  name: string;
  symbol: string;
  website: string;
  twitter: string;
  discord?: string;
  imageUrl: string;
  initialBuyUsd: number;
  description: string;
}

const tokenCopy = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "frontend/src/config/orbit-token.json"),
    "utf8",
  ),
) as OrbitTokenCopy;

/** Default mode: 2% fees, 25% post-migration fee compounding into pool liquidity. */
const BAGS_CONFIG_DEFAULT_25_COMPOUND =
  "fa29606e-5e48-4c37-827f-4b03d58ee23d";

const TOKEN = {
  name: process.env.ORBIT_LAUNCH_NAME ?? tokenCopy.name,
  symbol: process.env.ORBIT_LAUNCH_SYMBOL ?? tokenCopy.symbol,
  description: process.env.ORBIT_LAUNCH_DESCRIPTION ?? tokenCopy.description,
  imageUrl: process.env.ORBIT_LAUNCH_IMAGE_URL ?? tokenCopy.imageUrl,
  twitterUrl: process.env.ORBIT_LAUNCH_TWITTER ?? tokenCopy.twitter,
  websiteUrl: process.env.ORBIT_LAUNCH_WEBSITE ?? tokenCopy.website,
  telegramUrl: process.env.ORBIT_LAUNCH_TELEGRAM,
};

function parseInitialBuyLamports(): number {
  if (process.env.ORBIT_LAUNCH_INITIAL_BUY_SOL) {
    return Math.floor(
      Number(process.env.ORBIT_LAUNCH_INITIAL_BUY_SOL) * LAMPORTS_PER_SOL,
    );
  }
  const usd = Number(process.env.ORBIT_LAUNCH_INITIAL_BUY_USD ?? String(tokenCopy.initialBuyUsd));
  const solPrice = Number(process.env.ORBIT_LAUNCH_SOL_PRICE_USD ?? "150");
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(solPrice) || solPrice <= 0) {
    throw new Error("Invalid ORBIT_LAUNCH_INITIAL_BUY_USD or ORBIT_LAUNCH_SOL_PRICE_USD");
  }
  return Math.floor((usd / solPrice) * LAMPORTS_PER_SOL);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in backend/.env`);
  return value;
}

async function sendBundleWithTip(
  sdk: BagsSDK,
  connection: Connection,
  unsignedTransactions: VersionedTransaction[],
  keypair: Keypair,
): Promise<string> {
  const commitment = sdk.state.getCommitment();
  const bundleBlockhash = unsignedTransactions[0]?.message.recentBlockhash;
  if (!bundleBlockhash) {
    throw new Error("Bundle transactions must include a blockhash");
  }

  let jitoTip = Math.floor(0.015 * LAMPORTS_PER_SOL);
  const recommended = await sdk.solana.getJitoRecentFees().catch(() => null);
  if (recommended?.landed_tips_95th_percentile) {
    jitoTip = Math.floor(recommended.landed_tips_95th_percentile * LAMPORTS_PER_SOL);
  }

  const tipTransaction = await createTipTransaction(
    connection,
    commitment,
    keypair.publicKey,
    jitoTip,
    { blockhash: bundleBlockhash },
  );

  const signed = [tipTransaction, ...unsignedTransactions].map((tx) => {
    tx.sign([keypair]);
    return tx;
  });

  return sendBundleAndConfirm(signed, sdk);
}

async function main(): Promise<void> {
  const confirm = process.argv.includes("--confirm");
  const apiKey = requireEnv("BAGS_FM_API_KEY");
  const privateKeyB58 = requireEnv("CASINO_WALLET_PRIVATE_KEY");
  const rpcUrl =
    process.env.SOLANA_RPC_URL?.trim() ||
    (process.env.ALCHEMY_API_KEY
      ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://api.mainnet-beta.solana.com");

  const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));
  const initialBuyLamports = parseInitialBuyLamports();
  const bagsConfigType =
    process.env.BAGS_FM_CONFIG_TYPE ?? BAGS_CONFIG_DEFAULT_25_COMPOUND;

  const connection = new Connection(rpcUrl, "confirmed");
  const balanceLamports = await connection.getBalance(keypair.publicKey);
  const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
  const initialBuySol = initialBuyLamports / LAMPORTS_PER_SOL;

  console.log("\n🪐 Orbit Bags.fm launch plan\n");
  console.log(`  Wallet:        ${keypair.publicKey.toBase58()}`);
  console.log(`  Balance:       ${balanceSol.toFixed(4)} SOL`);
  console.log(`  Initial buy:   ${initialBuySol.toFixed(4)} SOL (~$${process.env.ORBIT_LAUNCH_INITIAL_BUY_USD ?? "140"})`);
  console.log(`  Fee mode:      Default (25% compounding liquidity post-migration)`);
  console.log(`  Config type:   ${bagsConfigType}`);
  console.log(`  Token:         ${TOKEN.name} ($${TOKEN.symbol})`);
  console.log(`  Image:         ${TOKEN.imageUrl}`);
  console.log(`  Mode:          ${confirm ? "LIVE LAUNCH" : "DRY RUN (pass --confirm to execute)"}\n`);

  const reserveSol = 0.08;
  if (balanceSol < initialBuySol + reserveSol) {
    throw new Error(
      `Insufficient treasury SOL. Need ~${(initialBuySol + reserveSol).toFixed(3)} SOL (buy + fees/tips), have ${balanceSol.toFixed(4)}`,
    );
  }

  if (!confirm) {
    console.log("Dry run complete. Re-run with --confirm when ready to launch.\n");
    return;
  }

  const sdk = new BagsSDK(apiKey, connection, "confirmed");
  const commitment = sdk.state.getCommitment();

  console.log("📝 Creating token metadata...");
  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    imageUrl: TOKEN.imageUrl,
    name: TOKEN.name,
    symbol: TOKEN.symbol,
    description: TOKEN.description,
    twitter: TOKEN.twitterUrl,
    website: TOKEN.websiteUrl,
    telegram: TOKEN.telegramUrl,
  });
  const tokenMint = new PublicKey(tokenInfo.tokenMint);
  console.log(`🪙 Mint: ${tokenMint.toBase58()}`);

  const feeClaimers = [{ user: keypair.publicKey, userBps: 10_000 }];
  console.log("⚙️  Creating fee share config (100% treasury, 25% compounding mode)...");

  let additionalLookupTables: PublicKey[] | undefined;
  if (feeClaimers.length > BAGS_FEE_SHARE_V2_MAX_CLAIMERS_NON_LUT) {
    const lutResult = await sdk.config.getConfigCreationLookupTableTransactions({
      payer: keypair.publicKey,
      baseMint: tokenMint,
      feeClaimers,
    });
    if (!lutResult) throw new Error("Failed to build lookup table transactions");
    await signAndSendTransaction(connection, commitment, lutResult.creationTransaction, keypair);
    await waitForSlotsToPass(connection, commitment, 1);
    for (const extendTx of lutResult.extendTransactions) {
      await signAndSendTransaction(connection, commitment, extendTx, keypair);
    }
    additionalLookupTables = lutResult.lutAddresses;
  }

  const configResult = await sdk.config.createBagsFeeShareConfig({
    payer: keypair.publicKey,
    baseMint: tokenMint,
    feeClaimers,
    additionalLookupTables,
    bagsConfigType,
  });

  if (configResult.bundles?.length) {
    for (const bundle of configResult.bundles) {
      await sendBundleWithTip(sdk, connection, bundle, keypair);
    }
  }
  for (const tx of configResult.transactions ?? []) {
    await signAndSendTransaction(connection, commitment, tx, keypair);
  }

  console.log(`🔑 Meteora config: ${configResult.meteoraConfigKey.toString()}`);

  console.log("🚀 Creating launch transaction...");
  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    metadataUrl: tokenInfo.tokenMetadata,
    tokenMint,
    launchWallet: keypair.publicKey,
    initialBuyLamports,
    configKey: configResult.meteoraConfigKey,
  });

  const signature = await signAndSendTransaction(connection, commitment, launchTx, keypair);

  const mint = tokenMint.toBase58();
  const bagsUrl = `https://bags.fm/${mint}`;

  console.log("\n✅ Token launched!\n");
  console.log(`  Mint:       ${mint}`);
  console.log(`  Signature:  ${signature}`);
  console.log(`  Bags URL:   ${bagsUrl}`);
  console.log("\nNext: wire the site (add to backend/.env, then deploy):\n");
  console.log(`  ORBIT_TOKEN_MINT=${mint}`);
  console.log(`  BAGS_FM_TOKEN_URL=${bagsUrl}`);
  console.log("  ORBIT_TOKEN_LAUNCH_STATUS=live");
  console.log("\nOr run: npm run orbit:wire-live -- " + mint + "\n");
}

main().catch((err) => {
  console.error("Launch failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
