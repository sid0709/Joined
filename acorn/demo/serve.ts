// Static server for the sprite player: `bun run --cwd acorn/demo dev` → http://localhost:5180
// Serves only web assets, never dotfiles, and nothing outside this folder.
import { extname, join, normalize, sep } from "node:path";

const PORT = Number(process.env.PORT ?? 5180);
const ROOT = import.meta.dir;
const SERVABLE = new Set([".html", ".js", ".css", ".json", ".png", ".webp", ".svg"]);

function resolve(pathname: string): string | null {
  const rel = normalize(decodeURIComponent(pathname === "/" ? "/index.html" : pathname));
  if (rel.split(sep).some((part) => part.startsWith("."))) return null;
  if (!SERVABLE.has(extname(rel).toLowerCase())) return null;
  const full = join(ROOT, rel);
  return full.startsWith(ROOT + sep) ? full : null;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = resolve(new URL(req.url).pathname);
    const file = path ? Bun.file(path) : null;
    return file && (await file.exists())
      ? new Response(file)
      : new Response("Not found", { status: 404 });
  },
});

console.log(`Sprite player on http://localhost:${PORT}`);
