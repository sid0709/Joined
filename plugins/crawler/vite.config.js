import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { copyFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-files",
      closeBundle: () => {
        mkdirSync("dist/icons", { recursive: true });

        copyFileSync("manifest.json", "dist/manifest.json");

        copyFileSync("public/icons/icon16.png", "dist/icons/icon16.png");
        copyFileSync("public/icons/icon48.png", "dist/icons/icon48.png");
        copyFileSync("public/icons/icon128.png", "dist/icons/icon128.png");
        copyFileSync("public/logo.png", "dist/logo.png");
      },
    },
  ],
  // One node_modules, at the repo root: keep Vite's cache there, not in this workspace.
  cacheDir: resolve(__dirname, "../../node_modules/.vite/crawler"),
  build: {
    // Chrome treats shared extension chunks as belonging to the execution
    // world that first loads them. Let native module imports load these
    // chunks instead of preloading them from the side-panel document.
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "src/background.js"),
        contentScript: resolve(__dirname, "src/contentScript/index.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background" || chunkInfo.name === "contentScript") {
            return "[name].js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
    outDir: "dist",
  },
  server: {
    port: 7173,
  },
});
