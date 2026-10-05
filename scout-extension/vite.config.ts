import path from "node:path";
import { fileURLToPath } from "node:url";

import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import manifest from "./manifest.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };
import {
  DEV_API_HOST,
  DEV_WEB_ORIGIN,
  PRODUCTION_API_HOST,
  PRODUCTION_WEB_ORIGIN,
  resolveHost,
  uniqueHostPermissions,
} from "./src/api/hosts";

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "VITE_");
  const apiHost = resolveHost(env.VITE_SCOUT_API_HOST, mode, PRODUCTION_API_HOST, DEV_API_HOST);
  const webOrigin = resolveHost(
    env.VITE_SCOUTWELL_WEB_ORIGIN,
    mode,
    PRODUCTION_WEB_ORIGIN,
    DEV_WEB_ORIGIN,
  );
  const host_permissions =
    mode === "production" ? uniqueHostPermissions([apiHost, webOrigin]) : manifest.host_permissions;

  return {
    base: "./",
    define: {
      "import.meta.env.VITE_SCOUT_VERSION": JSON.stringify(SCOUT_VERSION),
    },
    plugins: [
      logScoutVersion(),
      react(),
      crx({ manifest: { ...manifest, version: SCOUT_VERSION, host_permissions } }),
    ],
    cacheDir: path.resolve(rootDir, "../node_modules/.vite/scout-extension"),
    build: {
      modulePreload: false,
      rollupOptions: {
        input: {
          popup: "popup.html",
        },
      },
    },
  };
});
