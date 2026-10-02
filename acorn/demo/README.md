# Acorn demo

```bash
bun run --cwd acorn/demo dev
```

Then open http://localhost:5180.

A viewer for `@acorn/face`: the big stage, the sizes the extension uses (148 / 32 / 28 / 18px), every mood side by side, and a stress test with up to 200 badges that shows page fps. Switch **Renderer** to compare the shared worker with main-thread drawing. Keys 1–8 pick a mood.

The animation itself lives in `acorn/packages/acorn-face`; this folder only lays it out, so it can be redesigned or moved freely. `sheet.html` is a separate player for sprite-sheet images (drop one in, or pick a sample).
