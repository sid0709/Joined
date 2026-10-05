import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkProductionBuild } from "../src/packaging/checkManifest.ts";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(rootDir, "..", process.argv[2] ?? "dist");
const result = checkProductionBuild(distDir);

if (!result.ok) {
  for (const error of result.errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(`Production packaging check passed for ${distDir}`);
