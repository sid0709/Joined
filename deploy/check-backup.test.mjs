import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";

import { BACKUP_MAX_AGE_MS, backupStatus, checkBackupDir, maxAgeMs } from "./check-backup.mjs";

describe("backup check", () => {
  it("uses the named max age when BACKUP_MAX_AGE is empty", () => {
    expect(maxAgeMs("")).toBe(BACKUP_MAX_AGE_MS);
    expect(maxAgeMs("  ")).toBe(BACKUP_MAX_AGE_MS);
  });

  it("rejects a non-positive BACKUP_MAX_AGE", () => {
    expect(() => maxAgeMs("0")).toThrow("BACKUP_MAX_AGE");
    expect(() => maxAgeMs("nope")).toThrow("BACKUP_MAX_AGE");
  });

  it("fails when the directory has no archive", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joined-backup-"));
    await writeFile(path.join(dir, "notes.txt"), "not a dump");
    const status = await checkBackupDir(dir, Date.now(), BACKUP_MAX_AGE_MS);
    expect(status.ok).toBe(false);
    expect(status.message).toContain("no mongodump archive");
  });

  it("passes when the newest archive is inside the window", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joined-backup-"));
    const archive = path.join(dir, "joined-fresh.archive");
    await writeFile(archive, "dump");
    const status = await checkBackupDir(dir, Date.now(), BACKUP_MAX_AGE_MS);
    expect(status.ok).toBe(true);
  });

  it("fails when the newest archive is older than BACKUP_MAX_AGE", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joined-backup-"));
    const archive = path.join(dir, "joined-old.archive");
    await writeFile(archive, "dump");
    const old = new Date(Date.now() - BACKUP_MAX_AGE_MS - 60_000);
    await utimes(archive, old, old);
    const status = await checkBackupDir(dir, Date.now(), BACKUP_MAX_AGE_MS);
    expect(status.ok).toBe(false);
    expect(status.message).toContain("BACKUP_MAX_AGE");
    expect(backupStatus(null, Date.now(), 1).ok).toBe(false);
  });
});
