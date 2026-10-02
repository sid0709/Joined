/** Rest eyes are untilted circles. Smile / sad set pose.rot. Do not invent pupils, lids, or sockets. */

/** Crop to the silhouette so the head fills the CSS box. No plate padding. */
export const HEAD_VIEW = { x: 78, y: 86, size: 436 } as const;
export const SLANT = 0;
export const EYE_RADIUS = 21.75;

export const EYE_L = { x: 176.85, y: 369.89 };
export const EYE_R = { x: 264.19, y: 401.71 };
export const HEAD_ORIGIN = { x: 295, y: 330 };

/** Degrees. Right eye sits lower; small slits follow this line, not the page axes. */
export const FACE_LINE_ROT = 20;

export const HEAD_PATH =
  "M 300.50 96.12 C 250.60 107.58 201.79 165.38 187.01 230.50 C 185.27 238.19 183.43 244.98 182.93 245.58 C 182.44 246.18 177.55 248.58 172.08 250.92 C 129.54 269.08 99.15 300.61 89.36 336.73 C 85.51 350.93 85.49 370.07 89.32 384.77 C 102.66 436.02 153.07 478.35 222.50 496.59 C 229.65 498.47 239.33 500.49 244.00 501.09 C 248.68 501.68 254.13 502.58 256.12 503.08 C 258.10 503.59 273.04 504.00 289.31 504.00 C 318.36 504.00 319.16 503.95 334.19 500.92 C 379.53 491.80 412.30 475.76 437.35 450.43 C 463.37 424.10 473.98 393.08 468.50 359.29 C 466.17 344.92 459.17 327.72 450.60 315.27 C 445.27 307.54 445.55 306.56 456.52 294.77 C 473.69 276.31 488.23 253.63 496.70 232.07 C 501.50 219.84 502.84 213.94 504.07 199.57 C 505.89 178.35 501.57 163.62 489.99 151.57 C 466.93 127.55 423.00 130.30 378.97 158.52 C 368.66 165.13 367.75 164.67 366.57 152.27 C 363.87 123.86 347.99 102.40 325.30 96.49 C 319.03 94.86 306.79 94.68 300.50 96.12 Z";

/** Blink squash target. A slit, not a drawn lid. */
export const EYE_SLIT_SY = 0.07;

/** Happy squint: outer corners up (`\ /`). Offset from FACE_LINE_ROT. */
export const SMILE_SX = 1.32;
export const SMILE_SY = 0.26;
export const SMILE_ROT = 26;

/** Sad squint: inner corners up (`/ \`). Offset from FACE_LINE_ROT. */
export const SAD_SX = 1.18;
export const SAD_SY = 0.38;
export const SAD_ROT = 22;
export const SAD_Y = 7;

export const K_EYE = 16;
export const K_HEAD = 12;
export const K_COLOR = 6;
export const RIGHT_LAG = 0.8;

export const SACCAD_X = 9;
export const SACCAD_Y = 7;
export const SACCAD_MIN = 0.4;
export const SACCAD_MAX = 1.0;

export const BLINK_MIN_MS = 140;
export const BLINK_MAX_MS = 190;
export const BLINK_RIGHT_DELAY = 0.02;

/** Thinking: roll both whites up and inward (ceiling glance). Right eye sits lower at rest. */
export const THINK_EYE_IN = 16;
export const THINK_EYE_Y = -52;
export const THINK_EYE_R_Y = -78;
export const THINK_EYE_S = 0.86;
export const THINK_HEAD_ROT = -8;

/** Wink: close, hold, open, then wait. Seconds. */
export const WINK_CLOSE_S = 0.14;
export const WINK_HOLD_S = 0.36;
export const WINK_OPEN_S = 0.16;
export const WINK_GAP_S = 1.15;
