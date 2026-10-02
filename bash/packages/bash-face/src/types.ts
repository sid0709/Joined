export const BASH_FACE_MODES = [
  "waiting",
  "thinking",
  "working",
  "sleeping",
  "smile",
  "wink",
  "sad",
] as const;

export type BashFaceMode = (typeof BASH_FACE_MODES)[number];

export interface BashFaceHandle {
  setMode(name: BashFaceMode): void;
  /** Stop the rAF loop; keep the last painted pose. */
  setPaused(paused: boolean): void;
  destroy(): void;
}

export interface BashFaceMountOptions {
  /** CSS width of the SVG. Height follows the square viewBox. */
  size?: number | string;
  /** Skip saccades, breath, and other additives. Palettes still change. */
  reducedMotion?: boolean;
}
