import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AUDIT_TARGET_ENV, auditTargetForSite } from "./audit-auth.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** CI entry exits when the scan finishes (interactive `cli.mjs` keeps the server open). */
const cli = path.join(root, "node_modules/@unlighthouse/cli/dist/ci.mjs");

function siteFromArgs(args) {
  const flagIndex = args.findIndex((arg) => arg === "--site");
  if (flagIndex !== -1) return args[flagIndex + 1];
  return args.find((arg) => arg.startsWith("--site="))?.slice("--site=".length);
}

/**
 * @param {string[]} args Unlighthouse CLI args (without node/cli path).
 * @returns {Promise<number>} Exit code.
 */
export function runUnlighthouse(args) {
  const finalArgs = [...args];
  if (!finalArgs.includes("--disable-dynamic-sampling")) {
    finalArgs.push("--disable-dynamic-sampling");
  }
  if (!finalArgs.some((arg) => arg === "--build-static" || arg.startsWith("--build-static"))) {
    finalArgs.push("--build-static");
  }

  const site = siteFromArgs(finalArgs);
  const target = site ? auditTargetForSite(site) : undefined;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...finalArgs], {
      stdio: "inherit",
      cwd: root,
      env: { ...process.env, [AUDIT_TARGET_ENV]: target?.id ?? "" },
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });

    child.on("error", () => {
      resolve(1);
    });
  });
}

export function outputPathForTarget(targetId) {
  return path.join(root, ".unlighthouse", targetId);
}
