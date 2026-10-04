import type { Canvas2D } from "./art";
import { BUBBLE, BUBBLE_EDGE, GLYPH_FONT, SPARKLE, TEAR, TEAR_HIGHLIGHT } from "./constants";
import { clamp01 } from "./math";

export function sparkle(g: Canvas2D, x: number, y: number, s: number, alpha: number): void {
  if (s <= 0 || alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, s);
  grad.addColorStop(0, SPARKLE[0]);
  grad.addColorStop(0.35, SPARKLE[1]);
  grad.addColorStop(1, SPARKLE[2]);
  g.fillStyle = grad;
  const w = s * 0.24;
  g.beginPath();
  g.moveTo(0, -s);
  g.quadraticCurveTo(w, -w, s, 0);
  g.quadraticCurveTo(w, w, 0, s);
  g.quadraticCurveTo(-w, w, -s, 0);
  g.quadraticCurveTo(-w, -w, 0, -s);
  g.fill();
  g.restore();
}

export function tearDrop(g: Canvas2D, x: number, y: number, s: number, alpha: number): void {
  if (s <= 0 || alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  const grad = g.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, TEAR[0]);
  grad.addColorStop(0.5, TEAR[1]);
  grad.addColorStop(1, TEAR[2]);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, -s * 1.3);
  g.bezierCurveTo(s * 0.4, -s * 0.5, s * 0.8, 0, s * 0.8, s * 0.3);
  g.arc(0, s * 0.3, s * 0.8, 0, Math.PI, false);
  g.bezierCurveTo(-s * 0.8, 0, -s * 0.4, -s * 0.5, 0, -s * 1.3);
  g.fill();
  g.fillStyle = TEAR_HIGHLIGHT;
  g.beginPath();
  g.arc(-s * 0.28, s * 0.15, s * 0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function bubble(g: Canvas2D, x: number, y: number, r: number, alpha: number): void {
  g.globalAlpha = clamp01(alpha);
  g.fillStyle = BUBBLE;
  g.strokeStyle = BUBBLE_EDGE;
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.globalAlpha = 1;
}

export function glyph(
  g: Canvas2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void {
  g.globalAlpha = clamp01(alpha);
  g.fillStyle = color;
  g.font = `700 ${Math.round(size)}px ${GLYPH_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y);
  g.globalAlpha = 1;
}
