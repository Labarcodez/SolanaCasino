import { Router } from "express";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const tokenRouter = Router();

const METADATA_DIR = join(process.cwd(), "data", "token-metadata");

function ensureMetadataDir(): void {
  if (!existsSync(METADATA_DIR)) {
    mkdirSync(METADATA_DIR, { recursive: true });
  }
}

tokenRouter.get("/orbit", (_req, res) => {
  const row = db
    .prepare("SELECT mint FROM site_tokens ORDER BY registered_at DESC LIMIT 1")
    .get() as { mint: string } | undefined;

  res.json({
    mint: config.orbitTokenMint ?? row?.mint ?? null,
    pumpProgramId: config.pumpProgramId,
    cluster: config.solanaCluster,
  });
});

tokenRouter.get("/metadata/:id", (req, res) => {
  const filePath = join(METADATA_DIR, `${req.params.id}.json`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Metadata not found" });
    return;
  }
  const raw = readFileSync(filePath, "utf8");
  res.setHeader("Content-Type", "application/json");
  res.send(raw);
});

tokenRouter.post("/upload-metadata", (req, res) => {
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

  writeFileSync(join(METADATA_DIR, `${id}.json`), JSON.stringify(metadata));

  const uri = `${baseUrl}/api/token/metadata/${id}`;
  res.json({ uri, metadataId: id });
});

tokenRouter.post(
  "/register",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const { mint, signature } = req.body as { mint?: string; signature?: string };
    if (!mint || !signature) {
      res.status(400).json({ error: "mint and signature required" });
      return;
    }
    db.prepare(
      "INSERT OR REPLACE INTO site_tokens (mint, signature) VALUES (?, ?)",
    ).run(mint, signature);
    res.json({ success: true, mint });
  },
);
