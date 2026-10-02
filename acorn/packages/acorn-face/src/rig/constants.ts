// Rig tuning. Geometry is in fractions of the body image (W = width, H = height).

/** Eye centers. */
export const EYE_L = { x: 0.375, y: 0.615 };
export const EYE_R = { x: 0.668, y: 0.615 };
/** Eye radii, as fractions of W. */
export const EYE_RX = 0.118;
export const EYE_RY = 0.13;
/** Iris radius, as a fraction of the eye's horizontal radius. */
export const IRIS = 0.7;
/** Tilt and squash pivot: the bottom tip of the nut. */
export const PIVOT = { x: 0.52, y: 0.975 };
/** Cheek point whose color the lids reuse. */
export const SKIN_SAMPLE = { x: 0.52, y: 0.76 };

/* ---------- framing (the square canvas) ---------- */

/** Faces at least this many CSS px get room around the body for bubbles, sparkles, and a shadow. */
export const ROOMY_MIN_CSS_PX = 64;
/** Roomy: body height as a share of the canvas, and where its bottom sits. */
export const ROOMY_BODY = 0.6;
export const ROOMY_GROUND = 0.86;
/** Tight (badges): the body nearly fills the canvas. */
export const TIGHT_BODY = 0.94;
/** Tight faces get bigger eyes so the mood reads at badge size. */
export const TIGHT_EYE_SCALE = 1.18;
/** Tight faces hop lower so the acorn stays inside its badge. */
export const TIGHT_MOTION = 0.35;

/* ---------- level of detail and frame rate ---------- */

/** Eyes smaller than this (device px radius) are drawn flat: no gradients, one highlight. */
export const LOW_DETAIL_EYE_PX = 7;
/** Frame-rate caps by canvas size in device px. Tiny badges can't show more motion than this. */
export const FPS_TIERS: ReadonlyArray<{ maxDevicePx: number; fps: number }> = [
  { maxDevicePx: 48, fps: 24 },
  { maxDevicePx: 128, fps: 30 },
];
export const FPS_MAX = 60;

/* ---------- motion ---------- */

/** How fast poses settle after a mood change (per second). */
export const POSE_RATE = 7;
/** How fast the eyes reach a new look target. */
export const LOOK_RATE = 16;
/** How fast effects fade in and out. */
export const FX_RATE = 6;
export const BLINK_SECONDS = 0.17;
export const BLINK_GAP: [number, number] = [2.2, 5.2];
export const DOUBLE_BLINK_CHANCE = 0.18;
export const DOUBLE_BLINK_GAP = 0.12;
export const GLANCE_GAP: [number, number] = [1.2, 3.2];
export const HOP_SECONDS = 1.05;
/** Hop height, as a fraction of H. */
export const HOP_HEIGHT = 0.11;
/** Longest step a frame may advance; longer gaps (tab switches) don't fling poses. */
export const MAX_STEP_SECONDS = 0.1;

/* ---------- palette ---------- */

export const INK = "#3a1c0a";
export const SCLERA = ["#ffffff", "#f3ede6", "#d8c8b8"] as const;
export const IRIS_STOPS = ["#b8692a", "#6a3210", "#1d0b03"] as const;
export const PUPIL = "#0c0402";
export const FLAT_IRIS = "#3b1a07";
export const HIGHLIGHT = "rgba(255,255,255,0.95)";
export const HIGHLIGHT_SOFT = "rgba(255,255,255,0.6)";
export const SOCKET_ALPHA = 0.55;
export const LID_SHADOW = "rgba(60,28,8,0.28)";
export const TEAR = ["#e6f6ff", "#8fd0ff", "#4ba3e3"] as const;
export const TEAR_HIGHLIGHT = "rgba(255,255,255,0.8)";
export const SPARKLE = ["#ffffff", "#ffe48a", "#f4b400"] as const;
export const BUBBLE = "#ffffff";
export const BUBBLE_EDGE = "rgba(110, 60, 25, 0.28)";
export const SHADOW = "rgba(70, 38, 14, 0.2)";
export const SNORE = "#7a8aa8";
export const GLYPH_FONT = 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
