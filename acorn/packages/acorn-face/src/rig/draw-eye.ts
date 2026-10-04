import type { BodyArt, Canvas2D, Sprites } from "./art";
import {
  EYE_RX,
  EYE_RY,
  FLAT_IRIS,
  HIGHLIGHT,
  INK,
  IRIS,
  LID_SHADOW,
  LOW_DETAIL_EYE_PX,
  SOCKET_ALPHA,
} from "./constants";
import type { Pose } from "./poses";

/** One eye. `side` is -1 for the left eye, +1 for the right; inner corners face the middle. */
export function drawEye(
  g: Canvas2D,
  art: BodyArt,
  sprites: Sprites,
  cx: number,
  cy: number,
  side: number,
  p: Pose,
  happy: number,
  blink: number,
  eyePx: number,
): void {
  const { W } = art;
  const rx = EYE_RX * W * p.eyeScale;
  const ry = EYE_RY * W * p.eyeScale;
  const open = p.open * (1 - blink);
  const closed = Math.max(happy, p.sleep);
  const lowDetail = eyePx < LOW_DETAIL_EYE_PX;

  if (closed < 1) {
    g.save();
    g.globalAlpha = (1 - closed) * SOCKET_ALPHA;
    g.fillStyle = art.skinDark;
    g.beginPath();
    g.ellipse(cx, cy, rx * 1.035, ry * 1.03, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1 - closed;

    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.save();
    g.clip();
    const ir = rx * IRIS;
    const ix = cx + p.lookX * (rx - ir * 0.8);
    const iy = cy + p.lookY * (ry - ir * 0.8);
    if (lowDetail) {
      g.fillStyle = "#fff";
      g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      g.fillStyle = FLAT_IRIS;
      g.beginPath();
      g.arc(ix, iy, ir, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = HIGHLIGHT;
      g.beginPath();
      g.arc(ix - ir * 0.3, iy - ir * 0.35, ir * 0.3, 0, Math.PI * 2);
      g.fill();
    } else {
      const eye = sprites.eye(eyePx, (eyePx * ry) / rx);
      g.drawImage(eye.sclera, cx - rx, cy - ry, rx * 2, ry * 2);
      g.drawImage(eye.iris, ix - ir, iy - ir, ir * 2, ir * 2);
    }

    // upper lid comes down with `open` and tilts inner-corner-up when sad
    const lidY = -ry + (1 - open) * ry * 2.05;
    g.translate(cx, cy);
    g.rotate(side * p.sad * 0.34);
    g.fillStyle = art.skin;
    g.fillRect(-rx * 1.6, -ry * 1.6, rx * 3.2, lidY + ry * 1.6);
    if (open < 0.98) {
      g.fillStyle = LID_SHADOW;
      g.fillRect(-rx * 1.6, lidY, rx * 3.2, ry * 0.18);
      g.strokeStyle = INK;
      g.lineWidth = ry * 0.1;
      g.beginPath();
      g.moveTo(-rx * 1.6, lidY);
      g.lineTo(rx * 1.6, lidY);
      g.stroke();
    }
    if (p.squint > 0) {
      g.fillStyle = art.skin;
      g.fillRect(-rx * 1.6, ry - p.squint * ry * 1.1, rx * 3.2, ry * 1.6);
    }
    g.restore();
    g.restore();
  }

  g.save();
  g.strokeStyle = INK;
  g.lineCap = "round";
  g.lineWidth = rx * (lowDetail ? 0.3 : 0.24);
  if (happy > 0.01) {
    g.globalAlpha = happy;
    g.beginPath();
    g.moveTo(cx - rx * 0.72, cy + ry * 0.2);
    g.quadraticCurveTo(cx, cy - ry * 0.75, cx + rx * 0.72, cy + ry * 0.2);
    g.stroke();
  }
  if (p.sleep > 0.01) {
    g.globalAlpha = p.sleep * (1 - happy);
    g.beginPath();
    g.moveTo(cx - rx * 0.7, cy - ry * 0.05);
    g.quadraticCurveTo(cx, cy + ry * 0.55, cx + rx * 0.7, cy - ry * 0.05);
    g.stroke();
  }
  g.restore();
}
