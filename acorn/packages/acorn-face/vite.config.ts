import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  // One node_modules, at the repo root: keep Vite's cache there, not in this workspace.
  cacheDir: path.resolve(rootDir, "../../../node_modules/.vite/acorn-face"),
  server: {
    port: 5175,
    open: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
