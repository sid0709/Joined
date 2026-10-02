/** Every mood the acorn can show. Keep the original seven plus `help`; never drop one. */
export const ACORN_FACE_MODES = [
  "waiting",
  "thinking",
  "working",
  "help",
  "smile",
  "wink",
  "sad",
  "sleeping",
] as const;

export type AcornFaceMode = (typeof ACORN_FACE_MODES)[number];

export interface AcornFaceHandle {
  setMode(name: AcornFaceMode): void;
  /** Stop animating; the last painted frame stays on screen. */
  setPaused(paused: boolean): void;
  destroy(): void;
}

/**
 * Where frames are drawn. `auto` uses a shared Web Worker (off the main thread) when the page
 * allows it, and falls back to the main thread otherwise (e.g. content scripts on other sites).
 */
export type AcornFaceRenderer = "auto" | "worker" | "main";

/**
 * `roomy` leaves space around the body for bubbles, sparkles, and a shadow; `tight` fills the
 * square with the acorn (badges, icons). `auto` picks by size.
 */
export type AcornFaceFraming = "auto" | "roomy" | "tight";

export interface AcornFaceMountOptions {
  /** CSS size of the square face. Numbers are pixels. */
  size?: number | string;
  /** Hold still poses: no glances, breathing, hops, or drifting effects. */
  reducedMotion?: boolean;
  renderer?: AcornFaceRenderer;
  /** Starting mood. */
  mode?: AcornFaceMode;
}
