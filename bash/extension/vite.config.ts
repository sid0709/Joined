import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), crx({ manifest })],
  // One node_modules, at the repo root: keep Vite's cache there, not in this workspace.
  cacheDir: path.resolve(rootDir, "../../node_modules/.vite/bash-extension"),
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
