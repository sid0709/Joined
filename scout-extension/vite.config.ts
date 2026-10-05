import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const SCOUT_VERSION = pkg.version;

function logScoutVersion(): Plugin {
  return {
    name: "scout-version",
    configResolved(config) {
      config.logger.info(`\nScout extension v${SCOUT_VERSION} (${config.mode})\n`);
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_SCOUT_VERSION": JSON.stringify(SCOUT_VERSION),
  },
  plugins: [logScoutVersion(), react(), crx({ manifest: { ...manifest, version: SCOUT_VERSION } })],
  cacheDir: path.resolve(rootDir, "../node_modules/.vite/scout-extension"),
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: "popup.html",
      },
    },
  },
});
