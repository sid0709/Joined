import type { BashFaceMode } from "./types";

/** Same stops as the original Lumen fur ramp. Offsets never change; only colors do. */
export const FUR_STOP_OFFSETS = [
  "0%",
  "10%",
  "20%",
  "30%",
  "40%",
  "50%",
  "58%",
  "68%",
  "78%",
  "88%",
  "100%",
] as const;

export type FurRamp = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface FacePalette {
  fur: FurRamp;
  plateFrom: string;
  plateTo: string;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface RgbPalette {
  fur: Rgb[];
  plateFrom: Rgb;
  plateTo: Rgb;
}

/**
 * Per-mode fur language.
 * waiting — identity rainbow (ready).
 * thinking — ice / periwinkle (looking up).
 * working — ember coral-red (in the zone).
 * sleeping — dusk indigo, moonlight ear.
 * smile — peach-gold warmth.
 * wink — candy magenta.
 * sad — drained graphite.
 */
export const MODE_PALETTES: Record<BashFaceMode, FacePalette> = {
  waiting: {
    fur: [
      "#78d6fc",
      "#75c2fa",
      "#6fa9f8",
      "#6c91f8",
      "#616ff7",
      "#635af6",
      "#7c63f6",
      "#b878e2",
      "#e195ac",
      "#f4b769",
      "#ffd640",
    ],
    plateFrom: "#3a12a4",
    plateTo: "#1a0748",
  },
  thinking: {
    fur: [
      "#9ee9ff",
      "#7ed0ff",
      "#64b4ff",
      "#5494f8",
      "#4a74ee",
      "#4e5ee0",
      "#5a58d4",
      "#6a68d8",
      "#7e88e4",
      "#9ab0f0",
      "#c4d6f8",
    ],
    plateFrom: "#1a2468",
    plateTo: "#0a1030",
  },
  working: {
    fur: [
      "#ffc07a",
      "#ffa058",
      "#ff7a42",
      "#ff5436",
      "#ff3238",
      "#f01844",
      "#dc104c",
      "#e42838",
      "#ff5c34",
      "#ff8c2c",
      "#ffc440",
    ],
    plateFrom: "#6a1018",
    plateTo: "#220308",
  },
  sleeping: {
    fur: [
      "#4a688c",
      "#425c80",
      "#3a5074",
      "#36486c",
      "#384068",
      "#403c68",
      "#484470",
      "#545078",
      "#646078",
      "#787468",
      "#8a8460",
    ],
    plateFrom: "#121422",
    plateTo: "#08060e",
  },
  smile: {
    fur: [
      "#ffe08a",
      "#ffcc78",
      "#ffb070",
      "#ff9878",
      "#ff8090",
      "#f070b0",
      "#e068c0",
      "#f08098",
      "#ff9c70",
      "#ffc050",
      "#ffe45c",
    ],
    plateFrom: "#5a1858",
    plateTo: "#240828",
  },
  wink: {
    fur: [
      "#ffb8e0",
      "#ff98d0",
      "#ff78c4",
      "#f060c8",
      "#e050d4",
      "#d048e0",
      "#c058f0",
      "#e070d0",
      "#ff80a8",
      "#ffb070",
      "#ffd860",
    ],
    plateFrom: "#4a1460",
    plateTo: "#1c0830",
  },
  sad: {
    fur: [
      "#8a9098",
      "#7a8088",
      "#6c727a",
      "#5e646c",
      "#525860",
      "#4a4e56",
      "#444850",
      "#3e4248",
      "#4a4e54",
      "#5a5e64",
      "#6a6e74",
    ],
    plateFrom: "#1c1e22",
    plateTo: "#0a0c0e",
  },
};

export function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function formatHex(c: Rgb): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function paletteToRgb(p: FacePalette): RgbPalette {
  return {
    fur: p.fur.map(parseHex),
    plateFrom: parseHex(p.plateFrom),
    plateTo: parseHex(p.plateTo),
  };
}

function tickRgb(cur: Rgb, goal: Rgb, k: number, dt: number): void {
  const t = 1 - Math.exp(-k * dt);
  cur.r += (goal.r - cur.r) * t;
  cur.g += (goal.g - cur.g) * t;
  cur.b += (goal.b - cur.b) * t;
}

export function tickPalette(cur: RgbPalette, goal: FacePalette, k: number, dt: number): void {
  const target = paletteToRgb(goal);
  for (let i = 0; i < cur.fur.length; i += 1) {
    tickRgb(cur.fur[i], target.fur[i], k, dt);
  }
  tickRgb(cur.plateFrom, target.plateFrom, k, dt);
  tickRgb(cur.plateTo, target.plateTo, k, dt);
}

export function formatPalette(cur: RgbPalette): {
  fur: string[];
  plateFrom: string;
  plateTo: string;
} {
  return {
    fur: cur.fur.map(formatHex),
    plateFrom: formatHex(cur.plateFrom),
    plateTo: formatHex(cur.plateTo),
  };
}
