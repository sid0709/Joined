import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Acorn's VITE_* settings live in acorn/.env, shared with the extension.
  envDir: path.resolve(rootDir, ".."),
  // One node_modules, at the repo root: keep Vite's cache there, not in this workspace.
  cacheDir: path.resolve(rootDir, "../../node_modules/.vite/acorn-ui-board"),
  server: {
    port: 5173,
  },
});
