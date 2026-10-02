export const OAK_FACE_MODES = [
  "waiting",
  "thinking",
  "working",
  "sleeping",
  "smile",
  "wink",
  "sad",
] as const;

export type OakFaceMode = (typeof OAK_FACE_MODES)[number];

export interface OakFaceHandle {
  setMode(name: OakFaceMode): void;
  /** Stop the rAF loop; keep the last painted pose. */
  setPaused(paused: boolean): void;
  destroy(): void;
}

export interface OakFaceMountOptions {
  /** CSS width of the SVG. Height follows the square viewBox. */
  size?: number | string;
  /** Skip saccades, breath, and other additives. Palettes still change. */
  reducedMotion?: boolean;
}
