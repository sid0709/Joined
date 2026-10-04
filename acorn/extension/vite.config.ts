import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** The one Acorn version: package.json. The manifest, the UI, and the build log all read it. */
const ACORN_VERSION = pkg.version;

/** Prints the version being built, so every build log says which Acorn it produced. */
function logAcornVersion(): Plugin {
  return {
    name: "acorn-version",
    configResolved(config) {
      config.logger.info(`\nAcorn extension v${ACORN_VERSION} (${config.mode})\n`);
    },
  };
}

export default defineConfig({
  base: "./",
  // Acorn's VITE_* settings live in acorn/.env.
  envDir: path.resolve(rootDir, ".."),
  define: {
    "import.meta.env.VITE_ACORN_VERSION": JSON.stringify(ACORN_VERSION),
  },
  plugins: [logAcornVersion(), react(), crx({ manifest: { ...manifest, version: ACORN_VERSION } })],
  // One node_modules, at the repo root: keep Vite's cache there, not in this workspace.
  cacheDir: path.resolve(rootDir, "../../node_modules/.vite/acorn-extension"),
  build: {
    // Chrome extension pages reject Vite modulepreload (cross-world mismatch warnings).
    modulePreload: false,
    rollupOptions: {
      input: {
        sidebar: "sidebar.html",
      },
    },
  },
});
