import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** CI entry exits when the scan finishes (interactive `cli.mjs` keeps the server open). */
const cli = path.join(root, "node_modules/@unlighthouse/cli/dist/ci.mjs");

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

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...finalArgs], {
      stdio: "inherit",
      cwd: root,
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
