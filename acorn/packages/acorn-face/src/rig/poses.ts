import type { AcornFaceMode } from "../types";

/** Everything a mood can set. Body offsets are fractions of H; look is -1..1. */
export interface Pose {
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
  lookX: number;
  lookY: number;
  /** Upper lids: 1 = open, 0 = shut. */
  open: number;
  /** Happy "^" eyes, per side. */
  happyL: number;
  happyR: number;
  /** Relaxed closed "‿" eyes. */
  sleep: number;
  /** Lids slant inner-corner-up. */
  sad: number;
  /** Lower lids rise. */
  squint: number;
  eyeScale: number;
}

export type PoseKey = keyof Pose;

export const REST_POSE: Pose = {
  x: 0,
  y: 0,
  sx: 1,
  sy: 1,
  rot: 0,
  lookX: 0,
  lookY: 0,
  open: 1,
  happyL: 0,
  happyR: 0,
  sleep: 0,
  sad: 0,
  squint: 0,
  eyeScale: 1,
};

export const POSES: Record<AcornFaceMode, Partial<Pose>> = {
  waiting: {},
  thinking: { lookX: 0.6, lookY: -0.7, open: 0.9, rot: -0.05 },
  working: { lookY: 0.5, open: 0.72, squint: 0.22 },
  help: { eyeScale: 1.08 },
  smile: { happyL: 1, happyR: 1 },
  wink: { happyR: 1, lookX: 0.2, squint: 0.12, rot: 0.06 },
  sad: { lookY: 0.55, open: 0.6, sad: 1, y: 0.012, sy: 0.985 },
  sleeping: { sleep: 1, y: 0.02, sy: 0.975, rot: 0.04 },
};

export interface Effects {
  thought: number;
  question: number;
  sparkles: number;
  twinkle: number;
  tear: number;
  snore: number;
}

export const NO_EFFECTS: Effects = {
  thought: 0,
  question: 0,
  sparkles: 0,
  twinkle: 0,
  tear: 0,
  snore: 0,
};

export const EFFECTS: Record<AcornFaceMode, Partial<Effects>> = {
  waiting: {},
  thinking: { thought: 1 },
  working: {},
  help: { question: 1 },
  smile: { sparkles: 1 },
  wink: { twinkle: 1 },
  sad: { tear: 1 },
  sleeping: { snore: 1 },
};

/** Moods with eyes closed or curved, where a blink would look wrong. */
export const NO_BLINK: ReadonlySet<AcornFaceMode> = new Set(["smile", "wink", "sleeping"]);
