// Render toolbar/store icons from the live engine so they always match the animated acorn.
// Run: bun run --cwd acorn/packages/acorn-face icons -- <out-dir> [mode]
// Writes icon-16.png, icon-48.png, icon-128.png into <out-dir>.
import { join, resolve } from "node:path";
import puppeteer from "puppeteer";
import { ACORN_FACE_MODES, type AcornFaceMode } from "../src/types";

const SIZES = [16, 48, 128];
const outDir = Bun.argv[2] ? resolve(process.cwd(), Bun.argv[2]) : null;
const mode = (Bun.argv[3] ?? "waiting") as AcornFaceMode;
if (!outDir) throw new Error("Usage: icons <out-dir> [mode]");
if (!ACORN_FACE_MODES.includes(mode)) throw new Error(`Unknown mode "${mode}"`);

const bundle = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "still.ts")],
  target: "browser",
  format: "esm",
});
if (!bundle.success) throw new AggregateError(bundle.logs, "Bundling the renderer failed");
const code = await bundle.outputs[0].text();

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({
    type: "module",
    content: `${code}\nwindow.renderStill = renderStill;`,
  });
  await page.waitForFunction(() => "renderStill" in window);
  const pngs = await page.evaluate(
    async (sizes: number[], m: string) => {
      const render = (
        window as unknown as {
          renderStill: (m: string, px: number, o: object) => Promise<HTMLCanvasElement>;
        }
      ).renderStill;
      const out: Record<number, string> = {};
      for (const px of sizes)
        out[px] = (await render(m, px, { framing: "tight" })).toDataURL("image/png");
      return out;
    },
    SIZES,
    mode,
  );
  for (const px of SIZES) {
    const file = join(outDir, `icon-${px}.png`);
    await Bun.write(file, Buffer.from(pngs[px].split(",")[1], "base64"));
    console.log(file);
  }
} finally {
  await browser.close();
}
