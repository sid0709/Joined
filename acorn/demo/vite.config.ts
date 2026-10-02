import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // One node_modules, at the repo root: keep Vite's cache there, not in this workspace.
  cacheDir: path.resolve(rootDir, "../../node_modules/.vite/acorn-demo"),
  server: { port: 5180, strictPort: true },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
        sheet: path.resolve(rootDir, "sheet.html"),
      },
    },
  },
});
