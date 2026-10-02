// One acorn on one canvas: mood state, motion, and drawing. Host-agnostic (main thread or worker).
import type { AcornFaceMode } from "../types";
import { context2d, type AnyCanvas, type BodyArt, type Canvas2D, type Sprites } from "./art";
import {
  BLINK_GAP,
  BLINK_SECONDS,
  BUBBLE,
  BUBBLE_EDGE,
  DOUBLE_BLINK_CHANCE,
  DOUBLE_BLINK_GAP,
  EYE_L,
  EYE_R,
  EYE_RX,
  EYE_RY,
  FLAT_IRIS,
  FPS_MAX,
  FPS_TIERS,
  FX_RATE,
  GLANCE_GAP,
  GLYPH_FONT,
  HIGHLIGHT,
  HOP_HEIGHT,
  HOP_SECONDS,
  INK,
  IRIS,
  LID_SHADOW,
  LOOK_RATE,
  LOW_DETAIL_EYE_PX,
  PIVOT,
  POSE_RATE,
  ROOMY_BODY,
  ROOMY_GROUND,
  ROOMY_MIN_CSS_PX,
  SHADOW,
  SNORE,
  SOCKET_ALPHA,
  SPARKLE,
  TEAR,
  TEAR_HIGHLIGHT,
  TIGHT_BODY,
  TIGHT_EYE_SCALE,
  TIGHT_MOTION,
} from "./constants";
import {
  EFFECTS,
  NO_BLINK,
  NO_EFFECTS,
  POSES,
  REST_POSE,
  type Effects,
  type Pose,
  type PoseKey,
} from "./poses";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => {
  const v = clamp01(u);
  return v * v * (3 - 2 * v);
};
const approach = (cur: number, goal: number, rate: number, dt: number) =>
  cur + (goal - cur) * (1 - Math.exp(-rate * dt));
const POSE_KEYS = Object.keys(REST_POSE) as PoseKey[];
const EFFECT_KEYS = Object.keys(NO_EFFECTS) as (keyof Effects)[];
/** Reduced motion: stop redrawing once a new pose has had this long to settle. */
const SETTLE_SECONDS = 1.5;

export interface FaceOptions {
  mode: AcornFaceMode;
  cssSize: number;
  dpr: number;
  reducedMotion: boolean;
}

export class Face {
  readonly ctx: Canvas2D;
  mode: AcornFaceMode;
  paused = false;
  visible = true;
  /** Time of the last update, for frame-rate caps (ms, host clock). */
  lastTick = -Infinity;
  private cssSize: number;
  private reducedMotion: boolean;
  private t = 0;
  private modeT = 0;
  private pose: Pose;
  private look: { x: number; y: number };
  private fx: Effects;
  private blinkAt = rand(...BLINK_GAP);
  private blinkT = -1;
  private glanceAt = rand(...GLANCE_GAP);
  private glance = { x: 0, y: 0 };
  private needsBody = false;

  constructor(
    readonly canvas: AnyCanvas,
    private art: BodyArt,
    private sprites: Sprites,
    opts: FaceOptions,
    private requestFrame: () => void,
  ) {
    this.ctx = context2d(canvas);
    this.mode = opts.mode;
    this.cssSize = opts.cssSize;
    this.reducedMotion = opts.reducedMotion;
    this.pose = { ...REST_POSE, ...POSES[this.mode] };
    this.look = { x: this.pose.lookX, y: this.pose.lookY };
    this.fx = { ...NO_EFFECTS, ...EFFECTS[this.mode] };
    this.resize(opts.cssSize, opts.dpr);
  }

  resize(cssSize: number, dpr: number): void {
    this.cssSize = cssSize;
    const px = Math.max(1, Math.round(cssSize * dpr));
    if (this.canvas.width !== px) this.canvas.width = px;
    if (this.canvas.height !== px) this.canvas.height = px;
    this.lastTick = -Infinity;
  }

  setMode(mode: AcornFaceMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeT = 0;
    if (mode === "waiting") this.glanceAt = 0;
  }

  /** Frames per second this face needs, by its size. */
  get fps(): number {
    const px = this.canvas.width;
    return FPS_TIERS.find((tier) => px <= tier.maxDevicePx)?.fps ?? FPS_MAX;
  }

  /** Whether the face still changes on screen (reduced motion stops once settled). */
  get animating(): boolean {
    return !this.reducedMotion || this.modeT < SETTLE_SECONDS || this.needsBody;
  }

  /** Advance by dt seconds and paint. */
  step(dt: number): void {
    this.t += dt;
    this.modeT += dt;
    const target = { ...NO_EFFECTS, ...EFFECTS[this.mode] };
    for (const k of EFFECT_KEYS) this.fx[k] = approach(this.fx[k], target[k], FX_RATE, dt);
    const live = this.livePose(dt);
    this.draw(live, this.blinkAmount(dt));
  }

  /** Paint the current state without advancing time. */
  paint(): void {
    this.draw(this.livePose(0), 0);
  }

  /* ---------- motion ---------- */

  private get roomy(): boolean {
    return this.cssSize >= ROOMY_MIN_CSS_PX;
  }

  private livePose(dt: number): Pose {
    const still = this.reducedMotion;
    const t = this.t;
    const goal: Pose = { ...REST_POSE, ...POSES[this.mode] };
    const wave = (rate: number, amp: number, phase = 0) =>
      still ? 0 : Math.sin(t * rate + phase) * amp;
    let lookGoal = { x: goal.lookX, y: goal.lookY };
    const add = { x: 0, y: 0, sx: 0, sy: 0, rot: 0 };

    switch (this.mode) {
      case "waiting": {
        this.glanceAt -= dt;
        if (this.glanceAt <= 0) {
          this.glance =
            Math.random() < 0.35 ? { x: 0, y: 0 } : { x: rand(-0.55, 0.55), y: rand(-0.35, 0.3) };
          this.glanceAt = rand(...GLANCE_GAP);
        }
        if (!still) lookGoal = this.glance;
        add.sy = wave(2.1, 0.012);
        add.sx = -add.sy * 0.5;
        break;
      }
      case "thinking":
        lookGoal = { x: goal.lookX + wave(0.7, 0.12), y: goal.lookY + wave(1.1, 0.06) };
        add.rot = wave(1.2, 0.02);
        add.sy = wave(1.6, 0.008);
        break;
      case "working": {
        // reading: sweep left to right, then a quick return to the next line
        const u = (t / 1.15) % 1;
        const sweep = u < 0.82 ? -0.65 + 1.3 * (u / 0.82) : 0.65 - 1.3 * smooth((u - 0.82) / 0.18);
        if (!still) lookGoal = { x: sweep, y: goal.lookY + (u < 0.82 ? 0 : 0.08) };
        add.y = still ? 0 : -Math.abs(Math.sin(t * 7)) * 0.006;
        break;
      }
      case "help":
        add.rot = wave(1.7, 0.085);
        add.y = wave(3.4, 0.004);
        lookGoal = { x: wave(1.7, 0.12), y: 0.05 };
        break;
      case "smile": {
        if (still) break;
        // hop from the moment the mood starts: crouch, launch, airborne, land with a squash
        const u = (this.modeT % HOP_SECONDS) / HOP_SECONDS;
        if (u < 0.15) {
          const c = Math.sin((u / 0.15) * Math.PI);
          add.sy = -0.07 * c;
          add.sx = 0.05 * c;
        } else if (u < 0.7) {
          const a = (u - 0.15) / 0.55;
          add.y = -HOP_HEIGHT * 4 * a * (1 - a);
          add.sy = 0.05 * (1 - Math.abs(2 * a - 1));
          add.sx = -add.sy * 0.6;
        } else if (u < 0.85) {
          const c = Math.sin(((u - 0.7) / 0.15) * Math.PI);
          add.sy = -0.09 * c;
          add.sx = 0.07 * c;
        }
        break;
      }
      case "wink":
        // a quick playful lean into the wink
        add.rot = still ? 0 : 0.04 * Math.sin(Math.min(1, this.modeT / 0.35) * Math.PI);
        add.y = wave(2.6, 0.003);
        break;
      case "sad":
        add.rot = wave(0.9, 0.02);
        add.y = wave(0.9, 0.003, 1);
        lookGoal = { x: goal.lookX + wave(0.5, 0.15), y: goal.lookY };
        break;
      case "sleeping":
        add.sy = wave(1.1, 0.02);
        add.sx = -add.sy * 0.6;
        add.rot = wave(0.55, 0.015);
        break;
    }

    for (const k of POSE_KEYS) {
      if (k === "lookX" || k === "lookY") continue;
      this.pose[k] = dt ? approach(this.pose[k], goal[k], POSE_RATE, dt) : this.pose[k];
    }
    if (dt) {
      this.look.x = approach(this.look.x, lookGoal.x, LOOK_RATE, dt);
      this.look.y = approach(this.look.y, lookGoal.y, LOOK_RATE, dt);
    }
    const p = this.pose;
    return {
      ...p,
      eyeScale: p.eyeScale * (this.roomy ? 1 : TIGHT_EYE_SCALE),
      lookX: this.look.x,
      lookY: this.look.y,
      x: p.x + add.x,
      y: (p.y + add.y) * (this.roomy ? 1 : TIGHT_MOTION),
      sx: p.sx + add.sx,
      sy: p.sy + add.sy,
      rot: p.rot + add.rot,
    };
  }

  private blinkAmount(dt: number): number {
    if (NO_BLINK.has(this.mode) || this.reducedMotion) return 0;
    if (this.blinkT < 0) {
      this.blinkAt -= dt * (this.mode === "working" ? 1.6 : 1);
      if (this.blinkAt <= 0) {
        this.blinkT = 0;
        this.blinkAt = rand(...BLINK_GAP);
      }
      return 0;
    }
    this.blinkT += dt;
    if (this.blinkT > BLINK_SECONDS) {
      this.blinkT = -1;
      if (Math.random() < DOUBLE_BLINK_CHANCE) this.blinkAt = DOUBLE_BLINK_GAP;
      return 0;
    }
    return Math.sin((this.blinkT / BLINK_SECONDS) * Math.PI);
  }

  /* ---------- drawing ---------- */

  /** World (body px) to canvas (device px): scale k, then offset. */
  private layout(): { k: number; ox: number; oy: number } {
    const { W, H } = this.art;
    const D = this.canvas.width;
    const k = ((this.roomy ? ROOMY_BODY : TIGHT_BODY) * D) / H;
    return {
      k,
      ox: D / 2 - (W / 2) * k,
      oy: this.roomy ? D * ROOMY_GROUND - H * k : (D - H * k) / 2,
    };
  }

  /** Resolves when everything this face draws is ready at its current size (for stills). */
  prepare(): Promise<void> {
    const { k } = this.layout();
    return this.sprites.bodyReady(this.art.W * k, this.art.H * k);
  }

  private draw(p: Pose, blink: number): void {
    const g = this.ctx;
    const { W, H } = this.art;
    const D = this.canvas.width;
    const roomy = this.roomy;
    const { k, ox, oy } = this.layout();

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, D, this.canvas.height);
    g.setTransform(k, 0, 0, k, ox, oy);

    const px = PIVOT.x * W;
    const py = PIVOT.y * H;
    const lift = Math.max(0, -p.y / HOP_HEIGHT);

    if (roomy) {
      g.globalAlpha = 1 - lift * 0.5;
      g.fillStyle = SHADOW;
      g.beginPath();
      g.ellipse(px, py + 0.01 * H, 0.3 * W * (1 - lift * 0.35), 0.035 * H, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    g.save();
    g.translate(px + p.x * H, py + p.y * H);
    g.rotate(p.rot);
    g.scale(p.sx, p.sy);
    g.translate(-px, -py);
    const scaled = this.sprites.body(W * k, H * k, this.requestFrame);
    this.needsBody = scaled === null;
    g.drawImage(scaled ?? this.art.image, 0, 0, W, H);
    const eyePx = EYE_RX * W * p.eyeScale * k;
    this.drawEye(EYE_L.x * W, EYE_L.y * H, -1, p, p.happyL, blink, eyePx);
    this.drawEye(EYE_R.x * W, EYE_R.y * H, 1, p, p.happyR, blink, eyePx);
    if (this.fx.tear > 0.01) this.drawTear();
    g.restore();

    if (roomy) this.drawEffects(p);
  }

  /** One eye. `side` is -1 for the left eye, +1 for the right; inner corners face the middle. */
  private drawEye(
    cx: number,
    cy: number,
    side: number,
    p: Pose,
    happy: number,
    blink: number,
    eyePx: number,
  ): void {
    const g = this.ctx;
    const { W } = this.art;
    const rx = EYE_RX * W * p.eyeScale;
    const ry = EYE_RY * W * p.eyeScale;
    const open = p.open * (1 - blink);
    const closed = Math.max(happy, p.sleep);
    const lowDetail = eyePx < LOW_DETAIL_EYE_PX;

    if (closed < 1) {
      g.save();
      g.globalAlpha = (1 - closed) * SOCKET_ALPHA;
      g.fillStyle = this.art.skinDark;
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
        const eye = this.sprites.eye(eyePx, (eyePx * ry) / rx);
        g.drawImage(eye.sclera, cx - rx, cy - ry, rx * 2, ry * 2);
        g.drawImage(eye.iris, ix - ir, iy - ir, ir * 2, ir * 2);
      }

      // upper lid comes down with `open` and tilts inner-corner-up when sad
      const lidY = -ry + (1 - open) * ry * 2.05;
      g.translate(cx, cy);
      g.rotate(side * p.sad * 0.34);
      g.fillStyle = this.art.skin;
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
        g.fillStyle = this.art.skin;
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

  private drawTear(): void {
    const { W, H } = this.art;
    const u = (this.t % 2.6) / 2.6;
    const slide = smooth((u - 0.18) / 0.55);
    this.tearDrop(
      (EYE_L.x - EYE_RX * 0.55) * W,
      EYE_L.y * H + EYE_RY * W * 0.9 + slide * 0.16 * H,
      0.03 * W * smooth(u / 0.18),
      this.fx.tear * (1 - smooth((u - 0.62) / 0.2)),
    );
  }

  private drawEffects(p: Pose): void {
    const g = this.ctx;
    const { W, H } = this.art;
    const t = this.t;
    const fx = this.fx;
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
        this.sparkle(
          sx * W,
          sy * H + lift * 0.4,
          0.06 * W * Math.max(0, Math.sin(t * 3.2 + ph)),
          fx.sparkles,
        );
      }
    }
    if (fx.twinkle > 0.01) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      this.sparkle((EYE_R.x + 0.2) * W, (EYE_R.y - 0.22) * H, 0.07 * W * pulse, fx.twinkle);
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
        this.bubble(dx * W, dy * H + lift, r * W * (0.6 + 0.4 * on), fx.thought * on);
      });
    }
    if (fx.question > 0.01) {
      const bx = 1.08 * W;
      const by = -0.08 * H + Math.sin(t * 2.4) * 0.012 * H;
      const r = 0.12 * W;
      this.bubble(0.9 * W, 0.08 * H, 0.03 * W, fx.question);
      this.bubble(bx, by, r, fx.question);
      this.glyph("?", bx, by + r * 0.06, r * 1.25, INK, fx.question);
    }
    if (fx.snore > 0.01) {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.4 + i / 3) % 1;
        const size = 0.07 * W + u * 0.07 * W;
        this.glyph(
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

  /* ---------- effect shapes ---------- */

  private sparkle(x: number, y: number, s: number, alpha: number): void {
    if (s <= 0 || alpha <= 0) return;
    const g = this.ctx;
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

  private tearDrop(x: number, y: number, s: number, alpha: number): void {
    if (s <= 0 || alpha <= 0) return;
    const g = this.ctx;
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

  private bubble(x: number, y: number, r: number, alpha: number): void {
    const g = this.ctx;
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

  private glyph(
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    alpha: number,
  ): void {
    const g = this.ctx;
    g.globalAlpha = clamp01(alpha);
    g.fillStyle = color;
    g.font = `700 ${Math.round(size)}px ${GLYPH_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, x, y);
    g.globalAlpha = 1;
  }
}
