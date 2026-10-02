// Turn every samples/<name>.png sheet into a compact, evenly gridded WebP atlas the player can blit directly.
// Run: bun run --cwd acorn/demo build
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { processSheet } from "./sheet.js";

const ROOT = import.meta.dir;
const SAMPLES = join(ROOT, "samples");
const OUT = join(ROOT, "sprites");
/** Picker order; sheets not listed here follow alphabetically. */
const ORDER = ["idle", "think", "work", "help", "success", "sad"];
/** Strip this prefix from file names to get the status id (acorn-idle.png → idle). */
const NAME_PREFIX = "acorn-";
/** Near-lossless keeps fine edges and gradients crisp at a fraction of PNG's size. */
const WEBP = { nearLossless: true, quality: 80, alphaQuality: 100, effort: 6 } as const;

const files = (await readdir(SAMPLES)).filter((f) => f.endsWith(".png"));
const idOf = (f: string) => f.replace(/\.png$/, "").replace(NAME_PREFIX, "");
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
files.sort((a, b) => rank(idOf(a)) - rank(idOf(b)) || a.localeCompare(b));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const manifest = [];
for (const file of files) {
  const id = idOf(file);
  const src = Bun.file(join(SAMPLES, file));
  const { data, info } = await sharp(await src.arrayBuffer())
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height,
  };
  const { atlas, rows, cols, detected, keyed } = processSheet(px);

  const out = `${id}.webp`;
  await sharp(Buffer.from(atlas.data.buffer), {
    raw: { width: atlas.width, height: atlas.height, channels: 4 },
  })
    .webp(WEBP)
    .toFile(join(OUT, out));
  const kb = (n: number) => `${Math.round(n / 1024)} KB`;
  const size = Bun.file(join(OUT, out)).size;

  manifest.push({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    atlas: `sprites/${out}`,
    frameWidth: atlas.frameWidth,
    frameHeight: atlas.frameHeight,
    cols: atlas.cols,
    count: atlas.count,
  });
  console.log(
    `${file}: ${detected ? `${rows} × ${cols}` : "no grid found"}, ${atlas.count} frames ${atlas.frameWidth}×${atlas.frameHeight}` +
      `${keyed ? ", background removed" : ""} → ${out} ${kb(src.size)} → ${kb(size)}`,
  );
}

await Bun.write(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.length} sprites to sprites/manifest.json`);
