import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@oak/shared": path.resolve(rootDir, "../shared"),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [rootDir, path.resolve(rootDir, "..")] },
  },
});
