import {
  EYE_SLIT_SY,
  SACCAD_MAX,
  SACCAD_MIN,
  SACCAD_X,
  SACCAD_Y,
  SAD_ROT,
  SAD_SX,
  SAD_SY,
  SAD_Y,
  SMILE_ROT,
  SMILE_SX,
  SMILE_SY,
  THINK_EYE_IN,
  THINK_EYE_R_Y,
  THINK_EYE_S,
  THINK_EYE_Y,
  THINK_HEAD_ROT,
  WINK_CLOSE_S,
  WINK_GAP_S,
  WINK_HOLD_S,
  WINK_OPEN_S,
} from "./geometry";
import type { OakFaceMode } from "./types";

export interface Pose {
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
}

export interface FaceGoals {
  eyeL: Pose;
  eyeR: Pose;
  head: Pose;
}

export interface IdlePolicy {
  saccades: boolean;
  blinks: boolean;
  blinkIntervalMin: number;
  blinkIntervalMax: number;
  blinkDurationScale: number;
  saccadeScale: number;
}

export interface FrameAdd {
  eyeL: Pose;
  eyeR: Pose;
  head: Pose;
}

export interface PerformanceState {
  mode: OakFaceMode;
  /** Seconds since the current mode was set. */
  modeT: number;
  /** Wall seconds for looping scripts. */
  clock: number;
}

const REST_POSE: Pose = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };

const STILL: IdlePolicy = {
  saccades: false,
  blinks: false,
  blinkIntervalMin: 4,
  blinkIntervalMax: 8,
  blinkDurationScale: 1,
  saccadeScale: 1,
};

export function restPose(): Pose {
  return { ...REST_POSE };
}

export function restGoals(): FaceGoals {
  return {
    eyeL: restPose(),
    eyeR: restPose(),
    head: restPose(),
  };
}

export function zeroAdd(): FrameAdd {
  const z: Pose = { x: 0, y: 0, sx: 0, sy: 0, rot: 0 };
  return {
    eyeL: { ...z },
    eyeR: { ...z },
    head: { ...z },
  };
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function idlePolicy(mode: OakFaceMode): IdlePolicy {
  if (mode === "waiting") {
    return {
      saccades: true,
      blinks: true,
      blinkIntervalMin: 2.1,
      blinkIntervalMax: 5.2,
      blinkDurationScale: 1,
      saccadeScale: 1,
    };
  }
  if (mode === "thinking") {
    return {
      saccades: false,
      blinks: true,
      blinkIntervalMin: 2.8,
      blinkIntervalMax: 4.6,
      blinkDurationScale: 1.35,
      saccadeScale: 0,
    };
  }
  if (mode === "working") {
    return {
      saccades: true,
      blinks: true,
      blinkIntervalMin: 0.75,
      blinkIntervalMax: 1.6,
      blinkDurationScale: 0.72,
      saccadeScale: 0.4,
    };
  }
  if (mode === "sleeping" || mode === "wink") {
    return STILL;
  }
  if (mode === "smile") {
    return {
      saccades: false,
      blinks: true,
      blinkIntervalMin: 3.4,
      blinkIntervalMax: 6,
      blinkDurationScale: 0.85,
      saccadeScale: 0,
    };
  }
  return {
    saccades: false,
    blinks: true,
    blinkIntervalMin: 3.8,
    blinkIntervalMax: 6.8,
    blinkDurationScale: 1.45,
    saccadeScale: 0,
  };
}

function smoothstep(u: number): number {
  const p = Math.max(0, Math.min(1, u));
  return p * p * (3 - 2 * p);
}

/** 0 open → 1 sleeping-slit closed. Loops with a gap between winks. */
export function winkCloseAmount(modeT: number): number {
  const cycle = WINK_CLOSE_S + WINK_HOLD_S + WINK_OPEN_S + WINK_GAP_S;
  const t = ((modeT % cycle) + cycle) % cycle;
  if (t < WINK_CLOSE_S) return smoothstep(t / WINK_CLOSE_S);
  if (t < WINK_CLOSE_S + WINK_HOLD_S) return 1;
  if (t < WINK_CLOSE_S + WINK_HOLD_S + WINK_OPEN_S) {
    return 1 - smoothstep((t - WINK_CLOSE_S - WINK_HOLD_S) / WINK_OPEN_S);
  }
  return 0;
}

export function applyMode(goals: FaceGoals, state: PerformanceState): void {
  const { mode, modeT } = state;

  if (mode === "waiting") return;

  if (mode === "thinking") {
    goals.eyeL.x = THINK_EYE_IN;
    goals.eyeL.y = THINK_EYE_Y;
    goals.eyeR.x = -THINK_EYE_IN;
    goals.eyeR.y = THINK_EYE_R_Y;
    goals.eyeL.sx = THINK_EYE_S;
    goals.eyeL.sy = THINK_EYE_S;
    goals.eyeR.sx = THINK_EYE_S;
    goals.eyeR.sy = THINK_EYE_S;
    goals.head.rot = THINK_HEAD_ROT;
    return;
  }

  if (mode === "working") {
    goals.eyeL.y = 4;
    goals.eyeR.y = 4;
    goals.eyeL.sx = 0.9;
    goals.eyeL.sy = 0.78;
    goals.eyeR.sx = 0.9;
    goals.eyeR.sy = 0.78;
    return;
  }

  if (mode === "sleeping") {
    goals.eyeL.sx = 1.22;
    goals.eyeL.sy = EYE_SLIT_SY;
    goals.eyeR.sx = 1.22;
    goals.eyeR.sy = EYE_SLIT_SY;
    goals.eyeL.y = 3;
    goals.eyeR.y = 3;
    return;
  }

  if (mode === "smile") {
    goals.eyeL.sx = SMILE_SX;
    goals.eyeL.sy = SMILE_SY;
    goals.eyeL.rot = SMILE_ROT;
    goals.eyeL.y = -2;
    goals.eyeR.sx = SMILE_SX;
    goals.eyeR.sy = SMILE_SY;
    goals.eyeR.rot = -SMILE_ROT;
    goals.eyeR.y = -2;
    return;
  }

  if (mode === "wink") {
    goals.head.rot = 6 * winkCloseAmount(modeT);
    return;
  }

  if (mode === "sad") {
    goals.eyeL.sx = SAD_SX;
    goals.eyeL.sy = SAD_SY;
    goals.eyeL.rot = -SAD_ROT;
    goals.eyeL.y = SAD_Y;
    goals.eyeR.sx = SAD_SX;
    goals.eyeR.sy = SAD_SY;
    goals.eyeR.rot = SAD_ROT;
    goals.eyeR.y = SAD_Y;
    goals.head.rot = 4;
    goals.head.y = 3;
  }
}

export function applyFrameAdditives(add: FrameAdd, state: PerformanceState): void {
  const { mode, clock } = state;

  if (mode === "thinking") {
    const drift = Math.sin(clock * 0.85);
    add.eyeL.x += drift * 1.1;
    add.eyeR.x += drift * 1.1;
    add.eyeL.y += Math.sin(clock * 0.55) * 1.2;
    add.eyeR.y += Math.sin(clock * 0.55 + 0.2) * 1.2;
    return;
  }

  if (mode === "working") {
    add.eyeL.x += Math.sin(clock * 7.4) * 2.4;
    add.eyeR.x += Math.sin(clock * 7.4 + 0.35) * 2.4;
    add.eyeL.y += Math.sin(clock * 5.1) * 0.7;
    add.eyeR.y += Math.sin(clock * 5.1 + 0.4) * 0.7;
    return;
  }

  if (mode === "sleeping") {
    const breath = Math.sin(clock * 1.55);
    add.head.sy += breath * 0.02;
    add.head.y += breath * 2.1;
    return;
  }

  if (mode === "smile") {
    add.eyeL.sy += Math.sin(clock * 8.2) * 0.02;
    add.eyeR.sy += Math.sin(clock * 8.2 + 0.4) * 0.02;
    add.eyeL.rot += Math.sin(clock * 6.4) * 1.2;
    add.eyeR.rot -= Math.sin(clock * 6.4 + 0.3) * 1.2;
    return;
  }

  if (mode === "sad") {
    add.eyeL.y += Math.sin(clock * 1.3) * 0.7;
    add.eyeR.y += Math.sin(clock * 1.3 + 0.25) * 0.7;
  }
}

export function nextSaccadeDelay(): number {
  return rand(SACCAD_MIN, SACCAD_MAX);
}

export function randomSaccade(scale = 1): { x: number; y: number } {
  return {
    x: (Math.random() * 2 - 1) * SACCAD_X * scale,
    y: (Math.random() * 2 - 1) * SACCAD_Y * scale,
  };
}
