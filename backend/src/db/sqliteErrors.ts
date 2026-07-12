/** SQLite error helpers — EFS/NFS must not use WAL (causes corruption). */

export function isSqliteCorruptionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return (
    code === "SQLITE_CORRUPT" ||
    code === "SQLITE_NOTADB" ||
    code === "SQLITE_IOERR"
  );
}

export function usesEfsPersistence(): boolean {
  return Boolean(process.env.SQLITE_PATH);
}
