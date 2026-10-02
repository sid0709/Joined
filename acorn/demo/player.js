"use strict";

/** Bundled sheets offered in the Status picker. Add a sheet to samples/ and list it here. */
const STATUSES = [
  { id: "idle", label: "Idle", src: "samples/acorn-idle.png" },
  { id: "think", label: "Think", src: "samples/acorn-think.png" },
  { id: "work", label: "Work", src: "samples/acorn-work.png" },
  { id: "help", label: "Help", src: "samples/acorn-help.png" },
  { id: "success", label: "Success", src: "samples/acorn-success.png" },
  { id: "sad", label: "Sad", src: "samples/acorn-sad.png" },
];
const DEFAULT_GRID = { rows: 8, cols: 8 };
const MAX_GRID = 64;
/** Pixels with alpha below this count as empty on transparent sheets. */
const ALPHA_EMPTY = 40;
/** Max per-channel distance from the corner color that still counts as background on opaque sheets. */
const BG_TOLERANCE = 24;
/** Opaque sheets: a light pixel (every channel at least this) ... */
const BG_LIGHT_MIN = 185;
/** ... that is near-gray (channel spread at most this) is background, e.g. a checkerboard painted into the image. */
const BG_NEUTRAL_MAX = 16;
/** Key out the painted background only when it covers at least this share of the sheet. */
const BG_MIN_SHARE = 0.05;
/** A line belongs to a frame when it has more than this share of the busiest line's content. */
const BAND_LEVEL = 0.15;
/** Bands shorter than this share of the sheet are noise (sparkles, stray pixels), not frames. */
const BAND_MIN = 0.04;
/** A cell with less content than this share is treated as an empty frame. */
const EMPTY_CELL = 0.01;

const $ = (id) => document.getElementById(id);
const ui = {
  stage: $("stage"),
  mini28: $("mini28"),
  mini18: $("mini18"),
  play: $("play"),
  prev: $("prev"),
  next: $("next"),
  counter: $("counter"),
  fps: $("fps"),
  fpsOut: $("fpsOut"),
  blend: $("blend"),
  mode: $("mode"),
  bg: $("bg"),
  rows: $("rows"),
  cols: $("cols"),
  detect: $("detect"),
  skipEmpty: $("skipEmpty"),
  statusPick: $("statusPick"),
  file: $("file"),
  status: $("status"),
  sheet: $("sheet"),
  sheetImg: $("sheetImg"),
  cursor: $("cursor"),
};

const state = {
  /** Bumped on every load so a slow, older load can't overwrite a newer one. */
  loadId: 0,
  url: "",
  /** What frames are drawn from: the image, or a canvas holding it with the painted background removed. */
  source: null,
  width: 0,
  height: 0,
  /** RGBA pixels of the sheet, or null when the browser refuses to read them (file:// pages). */
  pixels: null,
  /** Every cell on the sheet as { x, y, w, h } in sheet pixels, row by row. */
  cells: [],
  /** Indices into `cells` to play, in order. */
  frames: [],
  /** Size every frame is drawn into, with each cell's anchor at its center. */
  box: { w: 1, h: 1 },
  /** Position in `frames`. */
  pos: 0,
  dir: 1,
  playing: true,
  last: 0,
  acc: 0,
  /** Cell index of the previous frame for the in-between transition. */
  previous: 0,
};

/* ---------- views ---------- */

function makeView(el) {
  const canvas = document.createElement("canvas");
  canvas.className = "layer";
  el.append(canvas);
  return { el, canvas, ctx: canvas.getContext("2d") };
}

const views = [makeView(ui.stage), makeView(ui.mini28), makeView(ui.mini18)];

/** Shape each view like a frame and size its canvas for the screen's pixel density. */
function fitViews() {
  const { w, h } = state.box;
  ui.stage.style.aspectRatio = `${w} / ${h}`;
  for (const el of [ui.mini28, ui.mini18]) {
    el.style.height = `${(parseFloat(el.style.width) * h) / w}px`;
  }
  const dpr = window.devicePixelRatio || 1;
  for (const v of views) {
    v.canvas.width = Math.max(1, Math.round(v.el.clientWidth * dpr));
    v.canvas.height = Math.max(1, Math.round(v.el.clientHeight * dpr));
  }
}

/** Draw one cell with its anchor at the center of the frame box. */
function drawCell(v, cell, alpha) {
  if (!state.source || alpha <= 0) return;
  const c = state.cells[cell];
  const scale = v.canvas.width / state.box.w;
  v.ctx.globalAlpha = alpha;
  v.ctx.drawImage(
    state.source,
    c.x,
    c.y,
    c.w,
    c.h,
    (state.box.w / 2 - (c.ax - c.x)) * scale,
    (state.box.h / 2 - (c.ay - c.y)) * scale,
    c.w * scale,
    c.h * scale,
  );
  v.ctx.globalAlpha = 1;
}

/* ---------- playback ---------- */

function nextPos(pos, dir) {
  const n = state.frames.length;
  if (n <= 1) return { pos: 0, dir };
  if (ui.mode.value === "loop") return { pos: (pos + 1) % n, dir: 1 };
  let p = pos + dir;
  let d = dir;
  if (p >= n) {
    d = -1;
    p = n - 2;
  }
  if (p < 0) {
    d = 1;
    p = 1;
  }
  return { pos: p, dir: d };
}

function drawInterpolated(v, fromIndex, toIndex, progress) {
  const from = state.cells[fromIndex];
  const to = state.cells[toIndex];
  if (!from || !to || !state.source) return;
  const t = progress * progress * (3 - 2 * progress);
  const mix = (a, b) => a + (b - a) * t;
  const cx = state.box.w / 2;
  const cy = state.box.h / 2;
  const scale = v.canvas.width / state.box.w;
  const fromX = from.ax - from.x;
  const fromY = from.ay - from.y;
  const toX = to.ax - to.x;
  const toY = to.ay - to.y;
  // Frame anchors are content-centered so every pose shares the same center during the transition.
  const fromW = from.w * scale;
  const fromH = from.h * scale;
  const toW = to.w * scale;
  const toH = to.h * scale;
  const fromLeft = (cx - fromX) * scale;
  const fromTop = (cy - fromY) * scale;
  const toLeft = (cx - toX) * scale;
  const toTop = (cy - toY) * scale;
  const x = mix(fromLeft, toLeft);
  const y = mix(fromTop, toTop);
  const w = mix(fromW, toW);
  const h = mix(fromH, toH);
  // Interpolate the position and scale of the character as one image. This avoids generating
  // temporary canvases every display frame and eliminates the translucent double-image ghost.
  v.ctx.save();
  v.ctx.beginPath();
  v.ctx.rect(x, y, w, h);
  v.ctx.clip();
  v.ctx.globalAlpha = 1 - t;
  v.ctx.drawImage(state.source, from.x, from.y, from.w, from.h, x, y, w, h);
  v.ctx.globalAlpha = t;
  v.ctx.drawImage(state.source, to.x, to.y, to.w, to.h, x, y, w, h);
  v.ctx.restore();
}

function render(progress) {
  if (!state.frames.length) return;
  const cur = state.frames[state.pos];
  const previous = state.frames[state.previous] ?? cur;
  const blend = state.playing && ui.blend.checked ? progress : 0;
  for (const v of views) {
    v.ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
    if (blend > 0 && previous !== cur) {
      drawInterpolated(v, previous, cur, blend);
    } else {
      drawCell(v, cur, 1);
    }
  }
  ui.counter.textContent = `${state.pos + 1} / ${state.frames.length}`;
  moveCursor(cur);
}

function step(delta) {
  const n = state.frames.length;
  if (!n) return;
  state.pos = (state.pos + delta + n) % n;
  state.previous = state.frames[state.pos];
  state.acc = 0;
  render(0);
}

function tick(now) {
  const dt = Math.min(0.25, (now - state.last) / 1000);
  state.last = now;
  if (state.playing && state.frames.length) {
    const frameDur = 1 / Number(ui.fps.value);
    state.acc += dt;
    while (state.acc >= frameDur) {
      state.acc -= frameDur;
      state.previous = state.frames[state.pos];
      const nx = nextPos(state.pos, state.dir);
      state.pos = nx.pos;
      state.dir = nx.dir;
    }
    render(state.acc / frameDur);
  }
  requestAnimationFrame(tick);
}

function setPlaying(on) {
  state.playing = on;
  ui.play.textContent = on ? "Pause" : "Play";
  state.acc = 0;
  state.previous = state.frames[state.pos] ?? 0;
  render(0);
}

/* ---------- sheet overlay ---------- */

function moveCursor(cell) {
  const c = state.cells[cell];
  Object.assign(ui.cursor.style, {
    left: `${(c.x / state.width) * 100}%`,
    top: `${(c.y / state.height) * 100}%`,
    width: `${(c.w / state.width) * 100}%`,
    height: `${(c.h / state.height) * 100}%`,
  });
}

ui.sheet.addEventListener("click", (e) => {
  const r = ui.sheetImg.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * state.width;
  const y = ((e.clientY - r.top) / r.height) * state.height;
  const cell = state.cells.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
  const idx = state.frames.indexOf(cell);
  if (idx < 0) return;
  setPlaying(false);
  state.pos = idx;
  render(0);
});

/* ---------- pixel analysis ---------- */

function readPixels(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  try {
    return g.getImageData(0, 0, c.width, c.height);
  } catch {
    return null; // tainted canvas: page opened from file:// with a bundled sample
  }
}

function hasTransparency(px) {
  const d = px.data;
  for (let o = 3; o < d.length; o += 4 * 97) if (d[o] < ALPHA_EMPTY) return true;
  return false;
}

/**
 * Opaque sheets often have a white or checkerboard "transparent" background painted in.
 * Flood-fill light, near-gray pixels from the edges and make them transparent. Starting at the
 * edges keeps light areas inside a frame (eye whites, highlights) intact.
 * Returns the keyed pixels, or null when no such background was found.
 */
function keyOutBackground(px) {
  const { width: w, height: h } = px;
  const src = px.data;
  const isBg = (i) => {
    const o = i * 4;
    const lo = Math.min(src[o], src[o + 1], src[o + 2]);
    const hi = Math.max(src[o], src[o + 1], src[o + 2]);
    return lo >= BG_LIGHT_MIN && hi - lo <= BG_NEUTRAL_MAX;
  };
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!seen[i] && isBg(i)) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  if (tail < w * h * BG_MIN_SHARE) return null;
  const out = new ImageData(new Uint8ClampedArray(src), w, h);
  for (let k = 0; k < tail; k++) out.data[queue[k] * 4 + 3] = 0;
  return out;
}

function pixelsToCanvas(px) {
  const c = document.createElement("canvas");
  c.width = px.width;
  c.height = px.height;
  c.getContext("2d").putImageData(px, 0, 0);
  return c;
}

function canvasToUrl(c) {
  return new Promise((resolve) => c.toBlob((b) => resolve(URL.createObjectURL(b)), "image/png"));
}

/** Returns a predicate telling whether pixel offset `o` holds content. */
function contentTest(px) {
  const d = px.data;
  if (hasTransparency(px)) return (o) => d[o + 3] >= ALPHA_EMPTY;
  const [r, g, b] = [d[0], d[1], d[2]];
  return (o) =>
    Math.abs(d[o] - r) > BG_TOLERANCE ||
    Math.abs(d[o + 1] - g) > BG_TOLERANCE ||
    Math.abs(d[o + 2] - b) > BG_TOLERANCE;
}

/** Content count per line across [a0, a1) × [b0, b1). `vertical` profiles columns instead of rows. */
function profile(px, has, a0, a1, b0, b1, vertical) {
  const w = px.width;
  const out = new Float32Array(a1 - a0);
  for (let a = a0; a < a1; a++) {
    let n = 0;
    for (let b = b0; b < b1; b++) {
      if (has((vertical ? b * w + a : a * w + b) * 4)) n++;
    }
    out[a - a0] = n;
  }
  return out;
}

/**
 * Split a profile into frames. Runs of busy lines are frames; each boundary goes at the
 * quietest line between two runs, so uneven spacing and touching frames still split cleanly.
 * The outer edges keep the same padding as the inner boundaries instead of the sheet's margins.
 * Returns { start, end, mid } spans (`mid` = center of the busy run), or null for a single frame.
 */
function splitBands(p) {
  let peak = 0;
  for (const v of p) peak = Math.max(peak, v);
  const level = peak * BAND_LEVEL;
  const runs = [];
  let start = -1;
  for (let i = 0; i <= p.length; i++) {
    const busy = i < p.length && p[i] > level;
    if (busy && start < 0) start = i;
    if (!busy && start >= 0) {
      if (i - start >= p.length * BAND_MIN) runs.push([start, i]);
      start = -1;
    }
  }
  if (runs.length < 2) return null;
  const cuts = [];
  const pads = [];
  for (let k = 1; k < runs.length; k++) {
    let best = runs[k - 1][1];
    for (let i = runs[k - 1][1]; i < runs[k][0]; i++) if (p[i] < p[best]) best = i;
    cuts.push(best);
    pads.push(best - runs[k - 1][1], runs[k][0] - best);
  }
  pads.sort((a, b) => a - b);
  const pad = pads[pads.length >> 1];
  const edges = [
    Math.max(0, runs[0][0] - pad),
    ...cuts,
    Math.min(p.length, runs[runs.length - 1][1] + pad),
  ];
  return runs.map(([a, b], k) => ({ start: edges[k], end: edges[k + 1], mid: (a + b) / 2 }));
}

/**
 * Find every frame on the sheet: rows first, then the columns within each row.
 * Each cell's anchor (ax, ay) is the center of its content: the row's band vertically, so bounces
 * within a row survive, and the frame's own band horizontally, so sloppy placement doesn't jitter.
 */
function detectCells(px) {
  const has = contentTest(px);
  const { width: w, height: h } = px;
  const rows = splitBands(profile(px, has, 0, h, 0, w, false)) ?? [
    { start: 0, end: h, mid: h / 2 },
  ];
  const cells = [];
  let maxCols = 1;
  for (const r of rows) {
    const cols = splitBands(profile(px, has, 0, w, r.start, r.end, true)) ?? [
      { start: 0, end: w, mid: w / 2 },
    ];
    maxCols = Math.max(maxCols, cols.length);
    for (const c of cols) {
      cells.push({
        x: c.start,
        y: r.start,
        w: c.end - c.start,
        h: r.end - r.start,
        ax: c.mid,
        ay: r.mid,
      });
    }
  }
  return cells.length > 1 ? { cells, rows: rows.length, cols: maxCols } : null;
}

function uniformCells(rows, cols) {
  const cells = [];
  const w = state.width / cols;
  const h = state.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c * w, y: r * h, w, h, ax: (c + 0.5) * w, ay: (r + 0.5) * h });
    }
  }
  return cells;
}

function hasContent(px, has, c) {
  const sample = 3;
  let hit = 0;
  let total = 0;
  for (let y = Math.floor(c.y); y < c.y + c.h; y += sample) {
    for (let x = Math.floor(c.x); x < c.x + c.w; x += sample) {
      total++;
      if (has((y * px.width + x) * 4)) hit++;
    }
  }
  return total > 0 && hit / total >= EMPTY_CELL;
}

/* ---------- grid + loading ---------- */

function clampGrid(n) {
  return Math.max(1, Math.min(MAX_GRID, Math.round(Number(n) || 1)));
}

/** Use these cells: pick the frames to play and redraw. */
function useCells(cells) {
  state.cells = cells;
  const all = cells.map((_, i) => i);
  let frames = all;
  if (ui.skipEmpty.checked && state.pixels) {
    const has = contentTest(state.pixels);
    frames = all.filter((i) => hasContent(state.pixels, has, cells[i]));
  }
  state.frames = frames.length ? frames : all;
  state.box = {
    w: 2 * Math.max(...cells.map((c) => Math.max(c.ax - c.x, c.x + c.w - c.ax))),
    h: 2 * Math.max(...cells.map((c) => Math.max(c.ay - c.y, c.y + c.h - c.ay))),
  };
  state.pos = Math.min(state.pos, state.frames.length - 1);
  state.previous = state.frames[state.pos] ?? 0;
  state.dir = 1;
  fitViews();
  render(0);
}

/** Rows/cols typed by hand: an even grid. */
function useManualGrid() {
  const rows = clampGrid(ui.rows.value);
  const cols = clampGrid(ui.cols.value);
  ui.rows.value = rows;
  ui.cols.value = cols;
  useCells(uniformCells(rows, cols));
}

function runDetect(note = "") {
  if (!state.pixels) {
    say(
      "Auto-detect can't read this image from a file:// page. Drop or pick the file instead, or set rows/cols by hand.",
    );
    useManualGrid();
    return;
  }
  const found = detectCells(state.pixels);
  if (!found) {
    say(`Couldn't find gaps between frames. Set rows/cols by hand.${note}`);
    useManualGrid();
    return;
  }
  ui.rows.value = found.rows;
  ui.cols.value = found.cols;
  state.pos = 0;
  useCells(found.cells);
  say(`Detected ${found.rows} × ${found.cols} grid, ${state.frames.length} frames${note}.`);
}

function say(msg) {
  ui.status.textContent = msg;
}

function load(url, name, { autodetect }) {
  const id = ++state.loadId;
  const img = new Image();
  img.onload = async () => {
    let pixels = readPixels(img);
    let source = img;
    let shown = url;
    let note = "";
    if (pixels && !hasTransparency(pixels)) {
      const keyed = keyOutBackground(pixels);
      if (keyed) {
        pixels = keyed;
        source = pixelsToCanvas(keyed);
        shown = await canvasToUrl(source);
        note = " · painted background removed";
      }
    }
    if (id !== state.loadId) {
      if (shown !== url) URL.revokeObjectURL(shown);
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      return;
    }
    if (shown !== url && url.startsWith("blob:")) URL.revokeObjectURL(url);
    if (state.url.startsWith("blob:") && state.url !== shown) URL.revokeObjectURL(state.url);
    state.url = shown;
    state.source = source;
    state.width = img.naturalWidth;
    state.height = img.naturalHeight;
    state.pixels = pixels;
    state.pos = 0;
    ui.sheetImg.src = shown;
    say(`${name} · ${img.naturalWidth}×${img.naturalHeight}${note}`);
    if (autodetect) runDetect(note);
    else useManualGrid();
  };
  img.onerror = () => {
    if (id === state.loadId) say(`Couldn't load ${name}.`);
  };
  img.src = url;
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    say("That isn't an image.");
    return;
  }
  ui.statusPick.value = "";
  load(URL.createObjectURL(file), file.name, { autodetect: true });
}

/* ---------- wiring ---------- */

ui.play.addEventListener("click", () => setPlaying(!state.playing));
ui.prev.addEventListener("click", () => {
  setPlaying(false);
  step(-1);
});
ui.next.addEventListener("click", () => {
  setPlaying(false);
  step(1);
});
ui.fps.addEventListener("input", () => {
  ui.fpsOut.textContent = `${ui.fps.value} fps`;
});
ui.blend.addEventListener("change", () => render(0));
ui.mode.addEventListener("change", () => {
  state.dir = 1;
});
ui.rows.addEventListener("change", useManualGrid);
ui.cols.addEventListener("change", useManualGrid);
ui.skipEmpty.addEventListener("change", () => useCells(state.cells));
ui.detect.addEventListener("click", () => runDetect());
ui.file.addEventListener("change", () => loadFile(ui.file.files[0]));
window.addEventListener("resize", () => {
  if (state.cells.length) {
    fitViews();
    render(0);
  }
});

ui.bg.addEventListener("change", () => {
  for (const el of [ui.stage, ui.mini28, ui.mini18]) {
    el.classList.remove("bg-checker", "bg-light", "bg-dark");
    el.classList.add(`bg-${ui.bg.value}`);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== "checkbox") return;
  if (e.code === "Space") {
    e.preventDefault();
    setPlaying(!state.playing);
  }
  if (e.code === "ArrowLeft") {
    setPlaying(false);
    step(-1);
  }
  if (e.code === "ArrowRight") {
    setPlaying(false);
    step(1);
  }
});

let dragDepth = 0;
document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  document.body.classList.add("dragging");
});
document.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    document.body.classList.remove("dragging");
  }
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove("dragging");
  loadFile(e.dataTransfer.files[0]);
});
document.addEventListener("paste", (e) => {
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
  if (item) loadFile(item.getAsFile());
});

function loadStatus(id) {
  const s = STATUSES.find((x) => x.id === id) ?? STATUSES[0];
  ui.statusPick.value = s.id;
  load(s.src, s.src.split("/").pop(), { autodetect: false });
}

for (const s of STATUSES) ui.statusPick.add(new Option(s.label, s.id));
ui.statusPick.addEventListener("change", () => loadStatus(ui.statusPick.value));

ui.rows.value = DEFAULT_GRID.rows;
ui.cols.value = DEFAULT_GRID.cols;
loadStatus(STATUSES[0].id);
state.last = performance.now();
requestAnimationFrame(tick);
