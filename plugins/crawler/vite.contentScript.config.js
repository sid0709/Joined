import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Chrome runs manifest content scripts as classic scripts, which cannot `import`. The
// content script shares modules with the side panel (src/routineKit), so a single
// multi-entry build would split them into a chunk it cannot load. Build it alone, as one
// self-contained file, after the main build (`bun run build`).
export default defineConfig({
  cacheDir: resolve(__dirname, "../../node_modules/.vite/crawler-content-script"),
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/contentScript/index.js"),
      formats: ["iife"],
      name: "crawlerContentScript",
      fileName: () => "contentScript.js",
    },
  },
});
