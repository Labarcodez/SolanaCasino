import { Router } from "express";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import {
  getBagsCreatorProfile,
  getBagsTokenLiveStats,
  isBagsApiConfigured,
} from "../services/bagsApi.js";
import { getTokenRewardLotteryStatus } from "../services/pumpCreatorRewards.js";
import { db } from "../db/index.js";
import { getTokenMetadataDir } from "../dataPaths.js";
import rateLimit from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

export const tokenRouter = Router();

const tokenUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_IMAGE_BASE64_CHARS = 500_000;

export type TokenLaunchPlatform = "bags" | "pump";
export type TokenLaunchStatus = "coming_soon" | "live";

const DEPRECATED_MINTS = new Set(config.orbitTokenDeprecatedMints);

function ensureMetadataDir(): void {
  const dir = getTokenMetadataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function isDeprecatedMint(mint: string | null | undefined): boolean {
  return Boolean(mint && DEPRECATED_MINTS.has(mint));
}

/** Only an explicit env mint can go live on the site — never auto-promote DB registrations. */
function resolveActiveMint(): string | null {
  const mint = config.orbitTokenMint.trim();
  if (!mint || isDeprecatedMint(mint)) {
    return null;
  }
  return mint;
}

function resolveLaunchStatus(mint: string | null): TokenLaunchStatus {
  if (config.orbitTokenLaunchStatus === "coming_soon") {
    return "coming_soon";
  }
  if (!mint || isDeprecatedMint(mint)) {
    return "coming_soon";
  }
  if (config.orbitTokenLaunchStatus !== "live") {
    return "coming_soon";
  }
  if (config.orbitTokenLaunchPlatform === "bags" && !config.bagsFmTokenUrl) {
    return "coming_soon";
  }
  return "live";
}

tokenRouter.get("/orbit", async (_req, res) => {
  const mint = resolveActiveMint();
  const launchPlatform = config.orbitTokenLaunchPlatform;
  const launchStatus = resolveLaunchStatus(mint);
  const bagsFmUrl =
    config.bagsFmTokenUrl ||
    (mint && launchPlatform === "bags" ? `https://bags.fm/${mint}` : null);

  const bagsCreator = isBagsApiConfigured()
    ? await getBagsCreatorProfile()
    : null;
  const bagsLiveStats =
    launchStatus === "live" && mint && isBagsApiConfigured()
      ? await getBagsTokenLiveStats(mint)
      : null;

  const rewardLottery = getTokenRewardLotteryStatus();

  res.json({
    mint: launchStatus === "live" ? mint : null,
    launchPlatform,
    launchStatus,
    treasuryWallet: config.casinoWalletAddress,
    bagsFmUrl: launchStatus === "live" ? bagsFmUrl : null,
    bagsFmProfileUrl: bagsCreator?.profileUrl ?? config.bagsFmProfileUrl,
    bagsCreator,
    bagsLiveStats,
    bagsApiConfigured: isBagsApiConfigured(),
    launchDateLabel: "TBA",
    pumpProgramId: config.pumpProgramId,
    cluster: config.solanaCluster,
    rewardLottery: {
      enabled: rewardLottery.enabled,
      intervalMs: rewardLottery.intervalMs,
      winnerPercent: rewardLottery.winnerPercent,
      nextRunAt: rewardLottery.nextRunAt,
      lastRunAt: rewardLottery.lastRunAt,
      recent: rewardLottery.recent.slice(0, 5),
    },
  });
});

tokenRouter.get("/rewards", (_req, res) => {
  res.json(getTokenRewardLotteryStatus());
});

tokenRouter.get("/metadata/:id", (req, res) => {
  const filePath = join(getTokenMetadataDir(), `${req.params.id}.json`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Metadata not found" });
    return;
  }
  const raw = readFileSync(filePath, "utf8");
  res.setHeader("Content-Type", "application/json");
  res.send(raw);
});

tokenRouter.post(
  "/upload-metadata",
  tokenUploadLimiter,
  requireAuth,
  requireAdmin,
  (req, res) => {
  const { name, symbol, description, imageBase64, twitter, telegram, website } =
    req.body as {
      name?: string;
      symbol?: string;
      description?: string;
      imageBase64?: string;
      twitter?: string;
      telegram?: string;
      website?: string;
    };

  if (!name || name.length < 3 || name.length > 32) {
    res.status(400).json({ error: "Name must be 3–32 characters" });
    return;
  }
  if (!symbol || symbol.length < 2 || symbol.length > 10) {
    res.status(400).json({ error: "Symbol must be 2–10 characters" });
    return;
  }
  if (!description || description.length > 500) {
    res.status(400).json({ error: "Description required (max 500 chars)" });
    return;
  }
  if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
    res.status(400).json({ error: "Valid image required (PNG/JPG base64)" });
    return;
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    res.status(400).json({ error: "Image too large (max ~375KB)" });
    return;
  }

  ensureMetadataDir();
  const id = uuidv4();
  const baseUrl =
    config.publicApiUrl ||
    config.frontendUrl.replace(/:\d+$/, "") ||
    "http://localhost:3001";

  const metadata = {
    name,
    symbol: symbol.toUpperCase(),
    description,
    image: imageBase64,
    external_url: website ?? config.frontendUrl,
    extensions: {
      ...(twitter ? { twitter } : {}),
      ...(telegram ? { telegram } : {}),
      ...(website ? { website } : {}),
    },
  };

  writeFileSync(join(getTokenMetadataDir(), `${id}.json`), JSON.stringify(metadata));

  const uri = `${baseUrl}/api/token/metadata/${id}`;
  res.json({ uri, metadataId: id });
  },
);

tokenRouter.post(
  "/register",
  requireAuth,
  requireAdmin,
  (req: AuthenticatedRequest, res) => {
    const { mint, signature } = req.body as { mint?: string; signature?: string };
    if (!mint || !signature) {
      res.status(400).json({ error: "mint and signature required" });
      return;
    }
    if (isDeprecatedMint(mint)) {
      res.status(400).json({ error: "This mint is retired and cannot be registered" });
      return;
    }
    db.prepare("DELETE FROM site_tokens").run();
    db.prepare("INSERT INTO site_tokens (mint, signature) VALUES (?, ?)").run(
      mint,
      signature,
    );
    res.json({ success: true, mint });
  },
);
