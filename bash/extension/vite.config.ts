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
  resolve: {
    alias: {
      "@oak/shared": path.resolve(rootDir, "../shared"),
      "@oak/face": path.resolve(rootDir, "../packages/oak-face/src/index.ts"),
    },
  },
  server: {
    fs: { allow: [rootDir, path.resolve(rootDir, "..")] },
  },
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
