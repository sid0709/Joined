import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/** Daily dumps are late after this age. Override with BACKUP_MAX_AGE (milliseconds). */
export const BACKUP_MAX_AGE_MS = 26 * 60 * 60 * 1000;

export const ARCHIVE_SUFFIX = ".archive";

/**
 * @param {string | undefined} raw
 * @returns {number}
 */
export function maxAgeMs(raw) {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") {
    return BACKUP_MAX_AGE_MS;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("BACKUP_MAX_AGE must be a positive number of milliseconds");
  }
  return parsed;
}

/**
 * @param {string} dir
 * @returns {Promise<number | null>} mtime of the newest `*.archive`, or null
 */
export async function newestArchiveMtime(dir) {
  const names = await readdir(dir);
  let newest = null;
  for (const name of names) {
    if (!name.endsWith(ARCHIVE_SUFFIX)) {
      continue;
    }
    const info = await stat(path.join(dir, name));
    if (newest === null || info.mtimeMs > newest) {
      newest = info.mtimeMs;
    }
  }
  return newest;
}

/**
 * @param {number | null} mtimeMs
 * @param {number} nowMs
 * @param {number} limitMs
 * @returns {{ ok: boolean, message: string }}
 */
export function backupStatus(mtimeMs, nowMs, limitMs) {
  if (mtimeMs === null) {
    return { ok: false, message: "no mongodump archive in BACKUP_DIR" };
  }
  const ageMs = nowMs - mtimeMs;
  if (ageMs > limitMs) {
    return {
      ok: false,
      message: `last dump is ${Math.round(ageMs)}ms old; BACKUP_MAX_AGE is ${limitMs}ms`,
    };
  }
  return { ok: true, message: `last dump is ${Math.round(ageMs)}ms old` };
}

export async function checkBackupDir(dir, nowMs, limitMs) {
  const mtime = await newestArchiveMtime(dir);
  return backupStatus(mtime, nowMs, limitMs);
}

async function main() {
  const dir = process.env.BACKUP_DIR?.trim() ?? "";
  if (dir === "") {
    console.error("BACKUP_DIR is required");
    process.exit(1);
  }
  let limit = BACKUP_MAX_AGE_MS;
  try {
    limit = maxAgeMs(process.env.BACKUP_MAX_AGE);
  } catch (err) {
    console.error(err instanceof Error ? err.message : "BACKUP_MAX_AGE is invalid");
    process.exit(1);
  }
  try {
    const status = await checkBackupDir(dir, Date.now(), limit);
    console.log(status.message);
    process.exit(status.ok ? 0 : 1);
  } catch (err) {
    console.error(err instanceof Error ? err.message : "backup check failed");
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
