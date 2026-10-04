// One acorn on one canvas: mood state, motion, and drawing. Host-agnostic (main thread or worker).
import type { AcornFaceFraming, AcornFaceMode } from "../types";
import { context2d, type AnyCanvas, type BodyArt, type Canvas2D, type Sprites } from "./art";
import {
  BLINK_GAP,
  BLINK_SECONDS,
  DOUBLE_BLINK_CHANCE,
  DOUBLE_BLINK_GAP,
  EYE_L,
  EYE_R,
  EYE_RX,
  FPS_MAX,
  FPS_TIERS,
  FX_RATE,
  GLANCE_GAP,
  HOP_HEIGHT,
  HOP_SECONDS,
  LOOK_RATE,
  PIVOT,
  POSE_RATE,
  ROOMY_BODY,
  ROOMY_GROUND,
  ROOMY_MIN_CSS_PX,
  SHADOW,
  TIGHT_BODY,
  TIGHT_EYE_SCALE,
  TIGHT_MOTION,
} from "./constants";
import { drawEffects, drawTear } from "./draw-effects";
import { drawEye } from "./draw-eye";
import { approach, rand, smooth } from "./math";
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

const POSE_KEYS = Object.keys(REST_POSE) as PoseKey[];
const EFFECT_KEYS = Object.keys(NO_EFFECTS) as (keyof Effects)[];
/** Reduced motion: stop redrawing once a new pose has had this long to settle. */
const SETTLE_SECONDS = 1.5;

export interface FaceOptions {
  mode: AcornFaceMode;
  cssSize: number;
  dpr: number;
  reducedMotion: boolean;
  framing?: AcornFaceFraming;
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
  private framing: AcornFaceFraming;
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
    this.framing = opts.framing ?? "auto";
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
    if (this.framing !== "auto") return this.framing === "roomy";
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
    drawEye(g, this.art, this.sprites, EYE_L.x * W, EYE_L.y * H, -1, p, p.happyL, blink, eyePx);
    drawEye(g, this.art, this.sprites, EYE_R.x * W, EYE_R.y * H, 1, p, p.happyR, blink, eyePx);
    if (this.fx.tear > 0.01) drawTear(g, this.art, this.t, this.fx);
    g.restore();

    if (roomy) drawEffects(g, this.art, this.t, this.fx, p);
  }
}
