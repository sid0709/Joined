import {
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  BLINK_RIGHT_DELAY,
  EYE_L,
  EYE_R,
  EYE_SLIT_SY,
  FACE_LINE_ROT,
  HEAD_ORIGIN,
  K_COLOR,
  K_EYE,
  K_HEAD,
  RIGHT_LAG,
} from "./geometry";
import {
  applyFrameAdditives,
  applyMode,
  idlePolicy,
  nextSaccadeDelay,
  rand,
  randomSaccade,
  restGoals,
  winkCloseAmount,
  zeroAdd,
  type FaceGoals,
  type Pose,
} from "./performances";
import { formatPalette, MODE_PALETTES, paletteToRgb, tickPalette } from "./palettes";
import { createFaceSvg, type BashFaceSvg } from "./svg";
import type { BashFaceHandle, BashFaceMode, BashFaceMountOptions } from "./types";

interface Channel {
  cur: number;
  goal: number;
  k: number;
}

interface Actor {
  x: Channel;
  y: Channel;
  sx: Channel;
  sy: Channel;
  rot: Channel;
}

type BlinkKind = "both" | "left" | "right";

interface BlinkEvent {
  t: number;
  duration: number;
  kind: BlinkKind;
  queued: number;
}

function channel(k: number, init = 0): Channel {
  return { cur: init, goal: init, k };
}

function tickChannel(ch: Channel, dt: number): void {
  ch.cur += (ch.goal - ch.cur) * (1 - Math.exp(-ch.k * dt));
}

function actor(k: number, scale = 1): Actor {
  return {
    x: channel(k * scale, 0),
    y: channel(k * scale, 0),
    sx: channel(k * scale, 1),
    sy: channel(k * scale, 1),
    rot: channel(k * scale, 0),
  };
}

function tickActor(a: Actor, dt: number): void {
  tickChannel(a.x, dt);
  tickChannel(a.y, dt);
  tickChannel(a.sx, dt);
  tickChannel(a.sy, dt);
  tickChannel(a.rot, dt);
}

function writeGoals(a: Actor, pose: Pose): void {
  a.x.goal = pose.x;
  a.y.goal = pose.y;
  a.sx.goal = pose.sx;
  a.sy.goal = pose.sy;
  a.rot.goal = pose.rot;
}

function blinkAmount(t: number, duration: number): number {
  if (t <= 0 || t >= duration) return 0;
  const u = t / duration;
  if (u < 0.45) {
    const p = u / 0.45;
    return p * p * (3 - 2 * p);
  }
  const p = (u - 0.45) / 0.55;
  const s = p * p * (3 - 2 * p);
  return 1 - s;
}

function eyeTransform(cx: number, cy: number, pose: Pose, blink: number, winkClose = 0): string {
  const close = Math.max(blink, winkClose);
  const sy = pose.sy + (EYE_SLIT_SY - pose.sy) * close;
  const slitT = Math.max(0, Math.min(1, (1 - sy) / (1 - EYE_SLIT_SY)));
  const rot = pose.rot + FACE_LINE_ROT * slitT;
  const sx = pose.sx + 0.22 * winkClose;
  return `translate(${cx + pose.x} ${cy + pose.y}) rotate(${rot}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
}

function pivotTransform(ox: number, oy: number, pose: Pose): string {
  return `translate(${ox + pose.x} ${oy + pose.y}) rotate(${pose.rot}) scale(${pose.sx} ${pose.sy}) translate(${-ox} ${-oy})`;
}

function readActor(a: Actor, add: Pose): Pose {
  return {
    x: a.x.cur + add.x,
    y: a.y.cur + add.y,
    sx: a.sx.cur + add.sx,
    sy: a.sy.cur + add.sy,
    rot: a.rot.cur + add.rot,
  };
}

export function mount(el: HTMLElement, options: BashFaceMountOptions = {}): BashFaceHandle {
  const svg: BashFaceSvg = createFaceSvg();
  const size = options.size ?? 280;
  const reducedMotion = Boolean(options.reducedMotion);
  svg.root.style.width = typeof size === "number" ? `${size}px` : size;
  svg.root.style.height = "auto";
  el.appendChild(svg.root);

  const eyeL = actor(K_EYE, 1);
  const eyeR = actor(K_EYE, RIGHT_LAG);
  const head = actor(K_HEAD, 1);
  const color = paletteToRgb(MODE_PALETTES.waiting);
  let mode: BashFaceMode = "waiting";
  let modeT = 0;
  let clock = 0;
  let saccadeIn = nextSaccadeDelay();
  let saccade = { x: 0, y: 0 };
  let blinkIn = rand(1.2, 3.2);
  let blink: BlinkEvent | null = null;
  let raf = 0;
  let last = performance.now();
  let alive = true;
  let paused = false;

  function startBlink(kind: BlinkKind, queued = 0): void {
    const policy = idlePolicy(mode);
    const duration = (rand(BLINK_MIN_MS, BLINK_MAX_MS) / 1000) * policy.blinkDurationScale;
    blink = { t: 0, duration, kind, queued };
  }

  function maybeQueueBlink(): void {
    const roll = Math.random();
    if (roll < 0.16) startBlink(Math.random() < 0.5 ? "left" : "right");
    else if (roll < 0.32) startBlink("both", 1);
    else startBlink("both");
  }

  function applyGoals(): FaceGoals {
    const goals = restGoals();
    const state = { mode, modeT, clock };
    applyMode(goals, state);

    const policy = idlePolicy(mode);
    if (policy.saccades && !reducedMotion) {
      goals.eyeL.x += saccade.x;
      goals.eyeL.y += saccade.y;
      goals.eyeR.x += saccade.x;
      goals.eyeR.y += saccade.y;
    }

    writeGoals(eyeL, goals.eyeL);
    writeGoals(eyeR, goals.eyeR);
    writeGoals(head, goals.head);
    return goals;
  }

  function render(): void {
    const add = zeroAdd();
    if (!reducedMotion) applyFrameAdditives(add, { mode, modeT, clock });

    const lBlink =
      blink && (blink.kind === "both" || blink.kind === "left")
        ? blinkAmount(blink.t, blink.duration)
        : 0;
    const rBlink =
      blink && (blink.kind === "both" || blink.kind === "right")
        ? blinkAmount(blink.t - BLINK_RIGHT_DELAY, blink.duration)
        : 0;

    const winkClose = mode === "wink" ? winkCloseAmount(modeT) : 0;
    const painted = formatPalette(color);
    svg.applyFur(painted.fur);

    const headPose = readActor(head, add.head);
    const eyeLPose = readActor(eyeL, add.eyeL);
    const eyeRPose = readActor(eyeR, add.eyeR);

    svg.head.setAttribute("transform", pivotTransform(HEAD_ORIGIN.x, HEAD_ORIGIN.y, headPose));
    svg.eyeL.setAttribute("transform", eyeTransform(EYE_L.x, EYE_L.y, eyeLPose, lBlink));
    svg.eyeR.setAttribute("transform", eyeTransform(EYE_R.x, EYE_R.y, eyeRPose, rBlink, winkClose));
  }

  function frame(now: number): void {
    if (!alive || paused) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    clock += dt;
    modeT += dt;

    const policy = idlePolicy(mode);
    if (policy.saccades && !reducedMotion) {
      saccadeIn -= dt;
      if (saccadeIn <= 0) {
        saccade = randomSaccade(policy.saccadeScale);
        saccadeIn = nextSaccadeDelay();
      }
    }

    if (policy.blinks && !reducedMotion) {
      if (blink) {
        blink.t += dt;
        if (blink.t > blink.duration + BLINK_RIGHT_DELAY + 0.02) {
          const queued = blink.queued;
          blink = null;
          if (queued > 0) startBlink("both", queued - 1);
        }
      } else {
        blinkIn -= dt;
        if (blinkIn <= 0) {
          maybeQueueBlink();
          blinkIn = rand(policy.blinkIntervalMin, policy.blinkIntervalMax);
        }
      }
    } else {
      blink = null;
    }

    applyGoals();
    tickActor(eyeL, dt);
    tickActor(eyeR, dt);
    tickActor(head, dt);
    tickPalette(color, MODE_PALETTES[mode], K_COLOR, dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  applyGoals();
  render();
  raf = requestAnimationFrame(frame);

  return {
    setMode(name: BashFaceMode) {
      if (name === mode) return;
      mode = name;
      modeT = 0;
      if (name === "sleeping") {
        saccade = { x: 0, y: 0 };
        blink = null;
      }
      if (name === "sad" || name === "wink") {
        saccade = { x: 0, y: 0 };
      }
      applyGoals();
      if (paused) render();
    },
    setPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      cancelAnimationFrame(raf);
      raf = 0;
      if (!paused && alive) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      svg.root.remove();
    },
  };
}
