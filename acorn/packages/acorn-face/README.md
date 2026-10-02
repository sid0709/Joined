# `@acorn/face`

The animated acorn. **This package is the only source of the animation**: the extension and `acorn/demo` both import it by name, so a change here shows up in both at once.

## API

```ts
import { mount, renderStill, ACORN_FACE_MODES, type AcornFaceMode } from "@acorn/face";

const face = mount(el, { size: 28, mode: "waiting" });
face.setMode("thinking");
face.setPaused(true); // keeps the last frame
face.destroy();

const icon = await renderStill("smile", 128, { framing: "tight" }); // one still frame on a canvas
```

Modes: `waiting` `thinking` `working` `help` `smile` `wink` `sad` `sleeping`. Keep all eight; the extension's director relies on the original seven.

Options: `size` (CSS px or any CSS length), `mode`, `reducedMotion` (defaults to the OS setting), `renderer` (`auto` | `worker` | `main`).

## How it's built

- **One painted body**, generated once and embedded as a 14 KB AVIF (`src/assets/body.ts`). Eyes, lids, blinks, and effects are drawn in code, so every frame is the same character.
- **Off the main thread:** faces draw into OffscreenCanvases inside one shared Web Worker. Where a worker can't run (content scripts on other sites, older browsers), the same code runs on the main thread.
- **One frame loop per thread**, frame-rate caps by size (24 / 30 / 60 fps), and no work at all for paused, off-screen, or hidden faces. Reduced motion stops redrawing once a pose settles.
- **Shared, pre-scaled sprites:** the body is scaled once per size and eye gradients are pre-rendered, so every 18px badge reuses the same bitmaps and each frame is a near 1:1 copy.
- **Level of detail:** below 64px the acorn fills its square with bigger eyes and no effects; tiny eyes are drawn flat.

## Art

| Script                                | What it does                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `bun run art -- body <reference.png>` | Generates body drafts with the OpenAI Images API into `art/raw/` (needs `OPENAI_API_KEY` in `acorn/.env`). |
| `bun run art:prepare`                 | Trims `art/acorn-body.png`, picks the smaller of WebP/AVIF, and embeds it in `src/assets/body.ts`.         |
| `bun run icons -- <out-dir> [mode]`   | Renders 16/48/128 PNG icons from the live engine.                                                          |

Eye placement and every motion number live in `src/rig/constants.ts` and `src/rig/poses.ts`.
