import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getDataDir, getDbPath } from "../dataPaths.js";

const MAX_STARTUP_BACKUPS = 30;
const MAX_CORRUPT_ARCHIVES = 10;

export function getBackupsDir(): string {
  return path.join(getDataDir(), "backups");
}

export function getOpsLogPath(): string {
  return path.join(getDataDir(), "ops.log");
}

export function appendOpsLog(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(getOpsLogPath(), line, "utf8");
  } catch {
    // ignore log write failures
  }
  console.log(`[ops] ${message}`);
}

function ensureBackupsDir(): string {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function pruneOldFiles(dir: string, prefix: string, keep: number): void {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files.slice(keep)) {
    try {
      fs.rmSync(path.join(dir, file.name), { force: true });
    } catch {
      // ignore prune errors
    }
  }
}

function copyDbArtifacts(sourceBase: string, destBase: string): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const src = `${sourceBase}${suffix}`;
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, `${destBase}${suffix}`);
    }
  }
}

function dbIntegrityOk(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  let database: Database.Database | null = null;
  try {
    database = new Database(filePath, { readonly: true });
    const integrity = database.pragma("integrity_check", {
      simple: true,
    }) as string;
    return integrity === "ok";
  } catch {
    return false;
  } finally {
    try {
      database?.close();
    } catch {
      // ignore
    }
  }
}

/** Snapshot the live DB before each container start (survives redeploys on EFS). */
export function backupDatabaseOnStartup(): string | null {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    appendOpsLog("startup: no casino.db yet — skip pre-start backup");
    return null;
  }

  if (!dbIntegrityOk(dbPath)) {
    appendOpsLog(
      "startup: casino.db failed integrity check — skip pre-start backup (recovery will archive)",
    );
    return null;
  }

  const dir = ensureBackupsDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destBase = path.join(dir, `pre-start-${stamp}`);
  copyDbArtifacts(dbPath, destBase);
  pruneOldFiles(dir, "pre-start-", MAX_STARTUP_BACKUPS);
  appendOpsLog(`startup: backed up casino.db → ${path.basename(destBase)}.db`);
  return `${destBase}.db`;
}

/** Move corrupt DB files into backups/corrupt-{stamp}/ for recovery. */
export function archiveCorruptDatabase(targetPath: string, reason: string): string {
  const dir = ensureBackupsDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = path.join(dir, `corrupt-${stamp}`);
  fs.mkdirSync(archiveDir, { recursive: true });

  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${targetPath}${suffix}`;
    if (fs.existsSync(file)) {
      const dest = path.join(archiveDir, `casino.db${suffix}`);
      fs.renameSync(file, dest);
    }
  }

  pruneOldFiles(dir, "corrupt-", MAX_CORRUPT_ARCHIVES);
  appendOpsLog(`recovery: archived corrupt DB to ${path.basename(archiveDir)} (${reason})`);
  return archiveDir;
}

export function listDatabaseBackups(): Array<{
  name: string;
  kind: "pre-start" | "corrupt";
  modifiedAt: string;
  sizeBytes: number;
}> {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) return [];

  const entries: Array<{
    name: string;
    kind: "pre-start" | "corrupt";
    modifiedAt: string;
    sizeBytes: number;
  }> = [];

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && name.startsWith("corrupt-")) {
      const dbFile = path.join(full, "casino.db");
      entries.push({
        name,
        kind: "corrupt",
        modifiedAt: stat.mtime.toISOString(),
        sizeBytes: fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0,
      });
      continue;
    }
    if (stat.isFile() && name.startsWith("pre-start-")) {
      entries.push({
        name,
        kind: "pre-start",
        modifiedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      });
    }
  }

  return entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
