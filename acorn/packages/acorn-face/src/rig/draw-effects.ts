import type { BodyArt, Canvas2D } from "./art";
import { EYE_L, EYE_R, EYE_RX, EYE_RY, INK, SNORE } from "./constants";
import { bubble, glyph, sparkle, tearDrop } from "./effect-shapes";
import { smooth } from "./math";
import type { Effects, Pose } from "./poses";

export function drawTear(g: Canvas2D, art: BodyArt, t: number, fx: Effects): void {
  const { W, H } = art;
  const u = (t % 2.6) / 2.6;
  const slide = smooth((u - 0.18) / 0.55);
  tearDrop(
    g,
    (EYE_L.x - EYE_RX * 0.55) * W,
    EYE_L.y * H + EYE_RY * W * 0.9 + slide * 0.16 * H,
    0.03 * W * smooth(u / 0.18),
    fx.tear * (1 - smooth((u - 0.62) / 0.2)),
  );
}

export function drawEffects(g: Canvas2D, art: BodyArt, t: number, fx: Effects, p: Pose): void {
  const { W, H } = art;
  const lift = p.y * H;

  if (fx.sparkles > 0.01) {
    const spots: [number, number, number][] = [
      [0.1, 0.18, 0],
      [0.92, 0.3, 1.7],
      [0.96, 0.72, 3.1],
      [0.04, 0.62, 4.4],
      [0.78, -0.05, 5.6],
    ];
    for (const [sx, sy, ph] of spots) {
      sparkle(
        g,
        sx * W,
        sy * H + lift * 0.4,
        0.06 * W * Math.max(0, Math.sin(t * 3.2 + ph)),
        fx.sparkles,
      );
    }
  }
  if (fx.twinkle > 0.01) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    sparkle(g, (EYE_R.x + 0.2) * W, (EYE_R.y - 0.22) * H, 0.07 * W * pulse, fx.twinkle);
  }
  if (fx.thought > 0.01) {
    const u = (t % 2.4) / 2.4;
    const dots: [number, number, number][] = [
      [0.86, 0.06, 0.03],
      [0.98, -0.05, 0.045],
      [1.12, -0.17, 0.065],
    ];
    dots.forEach(([dx, dy, r], i) => {
      const on = smooth((u - i * 0.18) / 0.12) * (1 - smooth((u - 0.85) / 0.15));
      bubble(g, dx * W, dy * H + lift, r * W * (0.6 + 0.4 * on), fx.thought * on);
    });
  }
  if (fx.question > 0.01) {
    const bx = 1.08 * W;
    const by = -0.08 * H + Math.sin(t * 2.4) * 0.012 * H;
    const r = 0.12 * W;
    bubble(g, 0.9 * W, 0.08 * H, 0.03 * W, fx.question);
    bubble(g, bx, by, r, fx.question);
    glyph(g, "?", bx, by + r * 0.06, r * 1.25, INK, fx.question);
  }
  if (fx.snore > 0.01) {
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.4 + i / 3) % 1;
      const size = 0.07 * W + u * 0.07 * W;
      glyph(
        g,
        "z",
        (0.84 + u * 0.28) * W,
        (0.16 - u * 0.3) * H + lift,
        size,
        SNORE,
        fx.snore * Math.sin(u * Math.PI),
      );
    }
  }
  g.globalAlpha = 1;
}
