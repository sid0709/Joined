// Trim the generated body to its silhouette and save a stage-sized WebP for the rig.
// Run: bun run --cwd acorn/demo art:prepare
import { join } from "node:path";
import sharp from "sharp";

const ART = join(import.meta.dir, "art");
/** Tallest the body is ever drawn: 320 CSS px stage × 2 device pixel ratio. */
const MAX_HEIGHT = 640;
const WEBP = { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true } as const;

const src = join(ART, "acorn-body.png");
const out = join(ART, "acorn-body.webp");
const info = await sharp(src)
  .trim({ threshold: 0 })
  .resize({ height: MAX_HEIGHT, withoutEnlargement: true, kernel: "lanczos3" })
  .webp(WEBP)
  .toFile(out);
console.log(`${out}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
