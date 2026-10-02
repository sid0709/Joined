// Sprite-sheet analysis shared by the build script (Bun) and the player (browser).
// Every function works on plain { data, width, height } RGBA pixels, so ImageData fits too.

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
/** Edge pixels this light and gray next to the removed background are leftover halo. */
const FRINGE_LIGHT_MIN = 150;
const FRINGE_NEUTRAL_MAX = 48;
/** How many pixels deep the halo is cleaned. */
const FRINGE_DEPTH = 2;
/** A line belongs to a frame when it has more than this share of the busiest line's content. */
const BAND_LEVEL = 0.15;
/** Bands shorter than this share of the sheet are noise (sparkles, stray pixels), not frames. */
const BAND_MIN = 0.04;
/** A cell with less content than this share is treated as an empty frame. */
const EMPTY_CELL = 0.01;
/** Frames per atlas row when packing. */
const ATLAS_MAX_COLS = 8;

export function hasTransparency(px) {
  const d = px.data;
  for (let o = 3; o < d.length; o += 4 * 97) if (d[o] < ALPHA_EMPTY) return true;
  return false;
}

/**
 * Opaque sheets often have a white or checkerboard "transparent" background painted in.
 * Flood-fill light, near-gray pixels from the edges and make them transparent, then clean the
 * light halo left along the edges. Starting at the edges keeps light areas inside a frame
 * (eye whites, highlights) intact. Returns new pixels, or null when no such background was found.
 */
export function keyOutBackground(px) {
  const { width: w, height: h } = px;
  const src = px.data;
  const spread = (i) => {
    const o = i * 4;
    const lo = Math.min(src[o], src[o + 1], src[o + 2]);
    const hi = Math.max(src[o], src[o + 1], src[o + 2]);
    return [lo, hi - lo];
  };
  const isBg = (i) => {
    const [lo, s] = spread(i);
    return lo >= BG_LIGHT_MIN && s <= BG_NEUTRAL_MAX;
  };
  const isFringe = (i) => {
    const [lo, s] = spread(i);
    return lo >= FRINGE_LIGHT_MIN && s <= FRINGE_NEUTRAL_MAX;
  };
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const neighbors = (i, visit) => {
    const x = i % w;
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (i >= w) visit(i - w);
    if (i < w * (h - 1)) visit(i + w);
  };
  const push = (test) => (i) => {
    if (!seen[i] && test(i)) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  };
  const pushBg = push(isBg);
  for (let x = 0; x < w; x++) {
    pushBg(x);
    pushBg((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushBg(y * w);
    pushBg(y * w + w - 1);
  }
  while (head < tail) neighbors(queue[head++], pushBg);
  if (tail < w * h * BG_MIN_SHARE) return null;

  const pushFringe = push(isFringe);
  let from = 0;
  for (let depth = 0; depth < FRINGE_DEPTH; depth++) {
    const to = tail;
    for (let k = from; k < to; k++) neighbors(queue[k], pushFringe);
    from = to;
  }

  const data = new Uint8ClampedArray(src);
  for (let k = 0; k < tail; k++) data[queue[k] * 4 + 3] = 0;
  return { data, width: w, height: h };
}

/** Returns a predicate telling whether pixel offset `o` holds content. */
export function contentTest(px) {
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
 * Returns { cells, rows, cols }, or null when the sheet looks like a single frame.
 */
export function detectCells(px) {
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

/** An even rows × cols grid over the whole sheet, anchored at cell centers. */
export function uniformCells(width, height, rows, cols) {
  const cells = [];
  const w = width / cols;
  const h = height / rows;
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

/**
 * Repack cells into an even atlas: every frame the same size, each cell's anchor at its frame's
 * center, empty cells dropped (when `skipEmpty`). Playing it needs no per-frame math at all.
 */
export function packAtlas(px, cells, { skipEmpty = true } = {}) {
  const has = contentTest(px);
  let keep = skipEmpty ? cells.filter((c) => hasContent(px, has, c)) : cells;
  if (!keep.length) keep = cells;
  const frameWidth = Math.ceil(
    2 * Math.max(...keep.map((c) => Math.max(c.ax - c.x, c.x + c.w - c.ax))),
  );
  const frameHeight = Math.ceil(
    2 * Math.max(...keep.map((c) => Math.max(c.ay - c.y, c.y + c.h - c.ay))),
  );
  const cols = Math.min(ATLAS_MAX_COLS, keep.length);
  const rows = Math.ceil(keep.length / cols);
  const width = cols * frameWidth;
  const height = rows * frameHeight;
  const data = new Uint8ClampedArray(width * height * 4);
  const src = px.data;
  keep.forEach((c, k) => {
    const x0 = Math.floor(c.x);
    const y0 = Math.floor(c.y);
    const x1 = Math.min(px.width, Math.ceil(c.x + c.w));
    const y1 = Math.min(px.height, Math.ceil(c.y + c.h));
    const ox = (k % cols) * frameWidth + Math.round(frameWidth / 2 - (c.ax - x0));
    const oy = Math.floor(k / cols) * frameHeight + Math.round(frameHeight / 2 - (c.ay - y0));
    const fx0 = (k % cols) * frameWidth;
    const fy0 = Math.floor(k / cols) * frameHeight;
    for (let y = y0; y < y1; y++) {
      const dy = oy + (y - y0);
      if (dy < fy0 || dy >= fy0 + frameHeight) continue;
      for (let x = x0; x < x1; x++) {
        const dx = ox + (x - x0);
        if (dx < fx0 || dx >= fx0 + frameWidth) continue;
        const s = (y * px.width + x) * 4;
        const d = (dy * width + dx) * 4;
        data[d] = src[s];
        data[d + 1] = src[s + 1];
        data[d + 2] = src[s + 2];
        data[d + 3] = src[s + 3];
      }
    }
  });
  return { data, width, height, frameWidth, frameHeight, cols, rows, count: keep.length };
}

/** Prepare any sheet: remove a painted background, find frames (or use an even grid), pack the atlas. */
export function processSheet(px, { grid = null, skipEmpty = true } = {}) {
  let pixels = px;
  let keyed = false;
  if (!hasTransparency(px)) {
    const k = keyOutBackground(px);
    if (k) {
      pixels = k;
      keyed = true;
    }
  }
  const found = grid ? null : detectCells(pixels);
  const layout = found ?? {
    cells: uniformCells(pixels.width, pixels.height, grid?.rows ?? 1, grid?.cols ?? 1),
    rows: grid?.rows ?? 1,
    cols: grid?.cols ?? 1,
  };
  return {
    atlas: packAtlas(pixels, layout.cells, { skipEmpty }),
    rows: layout.rows,
    cols: layout.cols,
    detected: Boolean(found),
    keyed,
  };
}
