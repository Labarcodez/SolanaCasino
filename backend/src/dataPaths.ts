import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Persistent data root — on ECS this is the EFS mount at /app/backend/data. */
export function getDataDir(): string {
  if (process.env.SQLITE_PATH) {
    return path.dirname(path.resolve(process.env.SQLITE_PATH));
  }
  return path.join(__dirname, "..", "..", "data");
}

export function getDbPath(): string {
  if (process.env.SQLITE_PATH) {
    return path.resolve(process.env.SQLITE_PATH);
  }
  return path.join(getDataDir(), "casino.db");
}

export function getTokenMetadataDir(): string {
  return path.join(getDataDir(), "token-metadata");
}

export function ensureDataDir(): string {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getPersistenceInfo(): {
  dataDir: string;
  dbPath: string;
  dbExists: boolean;
  metadataDir: string;
} {
  const dataDir = getDataDir();
  const dbPath = getDbPath();
  return {
    dataDir,
    dbPath,
    dbExists: fs.existsSync(dbPath),
    metadataDir: getTokenMetadataDir(),
  };
}
