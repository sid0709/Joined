# Sprite player demo

```bash
bun bash/demo/serve.ts
```

Then open http://localhost:5180. Pick a status (Idle, Think, Work, Help, Success, Sad) to play the bundled acorn sheets in `samples/`. To add one, drop the PNG in `samples/` and add it to `STATUSES` at the top of `player.js`.

Drop, pick, or paste (⌘V) any sprite sheet to play it. **Auto-detect** finds each row, then each frame within it, from the quiet gaps between them, so uneven spacing (e.g. 7 × 8 sheets) still works. A white or checkerboard background painted into an opaque image is removed automatically. Typing rows/cols switches to an even grid; **Skip empty cells** drops blank cells. Space plays/pauses, ← → step one frame, clicking a cell in the sheet jumps to it.
