import { spawn } from "node:child_process";
import path from "node:path";

import { AUDIT_FRONTENDS } from "./audit-frontends.mjs";
import { outputPathForTarget } from "./unlighthouse-run.mjs";

const HOST = "localhost";
const INDEX_FILE = "index.html";
const OPEN_COMMAND = process.platform === "darwin" ? "open" : "xdg-open";

/** @param {string} dir @param {string} requestPath @returns {string | null} Absolute file path inside `dir`. */
function resolveInside(dir, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const target = path.join(dir, decoded.endsWith("/") ? `${decoded}${INDEX_FILE}` : decoded);
  return target.startsWith(dir + path.sep) || target === dir ? target : null;
}

/**
 * Serve one app's static report on its report port.
 * @param {(typeof AUDIT_FRONTENDS)[number]} target
 */
function serveReport(target) {
  const dir = outputPathForTarget(target.id);
  return Bun.serve({
    hostname: HOST,
    port: target.reportPort,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const file = resolveInside(dir, pathname);
      if (!file) return new Response("Not found", { status: 404 });
      const blob = Bun.file(file);
      if (await blob.exists()) return new Response(blob);
      const index = Bun.file(path.join(file, INDEX_FILE));
      if (await index.exists()) return new Response(index);
      return new Response("Not found", { status: 404 });
    },
  });
}

/**
 * Serves every finished report and opens each in the default browser. Keeps running until Ctrl+C.
 * @param {(typeof AUDIT_FRONTENDS)} targets
 */
export function openAuditReports(targets = AUDIT_FRONTENDS) {
  for (const target of targets) {
    serveReport(target);
    const url = `http://${HOST}:${target.reportPort}/`;
    console.log(`${target.label}: ${url}`);
    spawn(OPEN_COMMAND, [url], { stdio: "ignore", detached: true }).unref();
  }
  console.log("\nReports are open. Press Ctrl+C to stop the report servers.\n");
}
