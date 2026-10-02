// Static server for the sprite player: `bun acorn/demo/serve.ts` → http://localhost:5180
import { join, normalize } from "node:path";

const PORT = Number(process.env.PORT ?? 5180);
const ROOT = import.meta.dir;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const file = Bun.file(join(ROOT, normalize(path === "/" ? "/index.html" : path)));
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});

console.log(`Sprite player on http://localhost:${PORT}`);
