// Acorn rig: one painted body + eyes, lids and effects drawn in code, so every frame is the same
// character and motion is smooth at any frame rate. Usage:
//   const acorn = await mountAcorn(canvas); acorn.setStatus("think");

export const STATUSES = [
  { id: "idle", label: "Idle" },
  { id: "think", label: "Think" },
  { id: "work", label: "Work" },
  { id: "help", label: "Help" },
  { id: "success", label: "Success" },
  { id: "sad", label: "Sad" },
];

const BODY_SRC = "art/acorn-body.webp";

/* ---------- geometry, as fractions of the body image (W = width, H = height) ---------- */

/** Eye centers. */
const EYE_L = { x: 0.375, y: 0.615 };
const EYE_R = { x: 0.668, y: 0.615 };
/** Eye radii as fractions of W. */
const EYE_RX = 0.118;
const EYE_RY = 0.13;
/** Iris radius as a fraction of the eye's horizontal radius. */
const IRIS = 0.7;
/** Where the body pivots for tilt and squash: bottom tip of the nut. */
const PIVOT = { x: 0.52, y: 0.975 };
/** Where skin color is sampled for the lids: the cheek below the eyes. */
const SKIN_SAMPLE = { x: 0.52, y: 0.76 };
/** Visible area around the body (fractions of W/H) so effects have room. */
const VIEW = { left: -0.3, right: 1.3, top: -0.24, bottom: 1.06 };

/* ---------- motion tuning ---------- */

/** How fast poses settle when the status changes (per second). */
const POSE_RATE = 7;
/** How fast the eyes jump to a new look target. */
const LOOK_RATE = 16;
/** How fast effects fade in and out. */
const FX_RATE = 6;
const BLINK_SECONDS = 0.17;
const BLINK_GAP = [2.2, 5.2];
const DOUBLE_BLINK_CHANCE = 0.18;
const DOUBLE_BLINK_GAP = 0.12;
const IDLE_GLANCE_GAP = [1.2, 3.2];

/* ---------- palette ---------- */

const INK = "#3a1c0a";
const SCLERA = ["#ffffff", "#f3ede6", "#d8c8b8"];
const IRIS_STOPS = ["#b8692a", "#6a3210", "#1d0b03"];
const PUPIL = "#0c0402";
/** How strongly the darker rim around each eye shows. */
const SOCKET_ALPHA = 0.55;
const TEAR = ["#e6f6ff", "#8fd0ff", "#4ba3e3"];
const SPARKLE = ["#ffffff", "#ffe48a", "#f4b400"];
const BUBBLE = "#ffffff";
const BUBBLE_EDGE = "rgba(110, 60, 25, 0.28)";
const SHADOW = "rgba(70, 38, 14, 0.2)";

/* ---------- poses ---------- */

const BASE_POSE = {
  x: 0,
  y: 0,
  sx: 1,
  sy: 1,
  rot: 0,
  lookX: 0,
  lookY: 0,
  open: 1,
  happy: 0,
  sad: 0,
  squint: 0,
  eyeScale: 1,
};

const POSES = {
  idle: {},
  think: { lookX: 0.6, lookY: -0.7, open: 0.9, rot: -0.05 },
  work: { lookY: 0.5, open: 0.72, squint: 0.22 },
  help: { open: 1, eyeScale: 1.08 },
  success: { happy: 1 },
  sad: { lookY: 0.55, open: 0.6, sad: 1, y: 0.012, sy: 0.985 },
};

/** Which effects each status shows. */
const EFFECTS = {
  idle: {},
  think: { thought: 1 },
  work: {},
  help: { question: 1 },
  success: { sparkles: 1 },
  sad: { tear: 1 },
};

/* ---------- helpers ---------- */

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (u) => {
  u = clamp01(u);
  return u * u * (3 - 2 * u);
};
const approach = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));
const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

let bodyPromise = null;
/** Decode the body once for every rig on the page, and sample its skin color for the lids. */
function loadBody(src) {
  bodyPromise ??= (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const r = Math.round(img.naturalWidth * 0.02);
    const d = g.getImageData(
      SKIN_SAMPLE.x * c.width - r,
      SKIN_SAMPLE.y * c.height - r,
      2 * r,
      2 * r,
    ).data;
    let [R, G, B, n] = [0, 0, 0, 0];
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3] > 200) {
        R += d[i];
        G += d[i + 1];
        B += d[i + 2];
        n++;
      }
    const skin = [R / n, G / n, B / n];
    const shade = (k) => `rgb(${skin.map((v) => Math.round(v * k)).join(",")})`;
    return {
      img,
      W: img.naturalWidth,
      H: img.naturalHeight,
      skin: shade(1),
      skinLight: shade(1.06),
      skinDark: shade(0.78),
    };
  })();
  return bodyPromise;
}

/* ---------- drawing ---------- */

function ellipsePath(g, cx, cy, rx, ry) {
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

/** One eye. `side` is -1 for the left eye, +1 for the right; inner corners face the middle. */
function drawEye(g, body, cx, cy, side, p, blink) {
  const rx = EYE_RX * body.W * p.eyeScale;
  const ry = EYE_RY * body.W * p.eyeScale;
  const open = p.open * (1 - blink);

  if (p.happy < 1) {
    g.save();
    g.globalAlpha = 1 - p.happy;

    // socket: a soft darker rim so the eye sits in the face
    ellipsePath(g, cx, cy, rx * 1.035, ry * 1.03);
    g.fillStyle = body.skinDark;
    g.globalAlpha = (1 - p.happy) * SOCKET_ALPHA;
    g.fill();
    g.globalAlpha = 1 - p.happy;

    ellipsePath(g, cx, cy, rx, ry);
    g.save();
    g.clip();

    const sclera = g.createRadialGradient(cx - rx * 0.25, cy - ry * 0.35, 0, cx, cy, ry * 1.15);
    sclera.addColorStop(0, SCLERA[0]);
    sclera.addColorStop(0.7, SCLERA[1]);
    sclera.addColorStop(1, SCLERA[2]);
    g.fillStyle = sclera;
    g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

    const ir = rx * IRIS;
    const ix = cx + p.lookX * (rx - ir * 0.8);
    const iy = cy + p.lookY * (ry - ir * 0.8);
    const iris = g.createRadialGradient(ix, iy + ir * 0.45, ir * 0.1, ix, iy, ir);
    iris.addColorStop(0, IRIS_STOPS[0]);
    iris.addColorStop(0.55, IRIS_STOPS[1]);
    iris.addColorStop(1, IRIS_STOPS[2]);
    g.fillStyle = iris;
    g.beginPath();
    g.arc(ix, iy, ir, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PUPIL;
    g.beginPath();
    g.arc(ix, iy - ir * 0.04, ir * 0.56, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath();
    g.arc(ix - ir * 0.33, iy - ir * 0.38, ir * 0.27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.beginPath();
    g.arc(ix + ir * 0.32, iy + ir * 0.3, ir * 0.1, 0, Math.PI * 2);
    g.fill();

    // upper lid: comes down with `open`, tilts inner-corner-up when sad
    const lidY = -ry + (1 - open) * ry * 2.05;
    g.save();
    g.translate(cx, cy);
    g.rotate(side * p.sad * 0.34);
    const lid = g.createLinearGradient(0, -ry, 0, lidY);
    lid.addColorStop(0, body.skinLight);
    lid.addColorStop(1, body.skin);
    g.fillStyle = lid;
    g.fillRect(-rx * 1.6, -ry * 1.6, rx * 3.2, lidY + ry * 1.6);
    const shadow = g.createLinearGradient(0, lidY, 0, lidY + ry * 0.22);
    shadow.addColorStop(0, "rgba(60,28,8,0.35)");
    shadow.addColorStop(1, "rgba(60,28,8,0)");
    g.fillStyle = shadow;
    g.fillRect(-rx * 1.6, lidY, rx * 3.2, ry * 0.22);
    if (open < 0.98) {
      g.strokeStyle = INK;
      g.lineWidth = ry * 0.1;
      g.beginPath();
      g.moveTo(-rx * 1.6, lidY);
      g.lineTo(rx * 1.6, lidY);
      g.stroke();
    }
    // lower lid: rises with `squint`
    if (p.squint > 0) {
      const lowY = ry - p.squint * ry * 1.1;
      g.fillStyle = body.skin;
      g.fillRect(-rx * 1.6, lowY, rx * 3.2, ry * 1.6);
    }
    g.restore();
    g.restore();
    g.restore();
  }

  if (p.happy > 0) {
    g.save();
    g.globalAlpha = p.happy;
    g.strokeStyle = INK;
    g.lineCap = "round";
    g.lineWidth = rx * 0.24;
    g.beginPath();
    g.moveTo(cx - rx * 0.72, cy + ry * 0.2);
    g.quadraticCurveTo(cx, cy - ry * 0.75, cx + rx * 0.72, cy + ry * 0.2);
    g.stroke();
    g.restore();
  }
}

function sparkle(g, x, y, s, alpha) {
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

function tearDrop(g, x, y, s, alpha) {
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
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.beginPath();
  g.arc(-s * 0.28, s * 0.15, s * 0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function bubble(g, x, y, r, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = BUBBLE;
  g.strokeStyle = BUBBLE_EDGE;
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}

/* ---------- the rig ---------- */

export async function mountAcorn(canvas, { status = "idle", src = BODY_SRC } = {}) {
  const body = await loadBody(src);
  const g = canvas.getContext("2d");
  const W = body.W;
  const H = body.H;
  const viewW = (VIEW.right - VIEW.left) * W;
  const viewH = (VIEW.bottom - VIEW.top) * H;

  let current = status;
  let speed = 1;
  let raf = 0;
  let last = performance.now();
  let t = 0;
  const pose = { ...BASE_POSE, ...POSES[current] };
  const fx = { thought: 0, question: 0, sparkles: 0, tear: 0, ...EFFECTS[current] };
  let blinkAt = rand(...BLINK_GAP);
  let blinkT = -1;
  let glanceAt = rand(...IDLE_GLANCE_GAP);
  let glance = { x: 0, y: 0 };
  let look = { x: pose.lookX, y: pose.lookY };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round((canvas.clientWidth * viewH * dpr) / viewW));
    canvas.style.height = `${(canvas.clientWidth * viewH) / viewW}px`;
  }

  /** Pose for this instant: the status's resting pose plus its moving parts. */
  function livePose(dt) {
    const still = reducedMotion();
    const goal = { ...BASE_POSE, ...POSES[current] };
    const wave = (rate, amp, phase = 0) => (still ? 0 : Math.sin(t * rate + phase) * amp);
    let lookGoal = { x: goal.lookX, y: goal.lookY };
    const add = { x: 0, y: 0, sx: 0, sy: 0, rot: 0 };

    if (current === "idle") {
      glanceAt -= dt;
      if (glanceAt <= 0) {
        glance = { x: rand(-0.55, 0.55), y: rand(-0.35, 0.3) };
        if (Math.random() < 0.35) glance = { x: 0, y: 0 };
        glanceAt = rand(...IDLE_GLANCE_GAP);
      }
      lookGoal = still ? lookGoal : glance;
      add.sy = wave(2.1, 0.012);
      add.sx = -add.sy * 0.5;
    }
    if (current === "think") {
      lookGoal = { x: goal.lookX + wave(0.7, 0.12), y: goal.lookY + wave(1.1, 0.06) };
      add.rot = wave(1.2, 0.02);
      add.sy = wave(1.6, 0.008);
    }
    if (current === "work") {
      // reading: sweep left to right, then a quick return to the next line
      const u = (t / 1.15) % 1;
      const sweep = u < 0.82 ? -0.65 + 1.3 * (u / 0.82) : 0.65 - 1.3 * smooth((u - 0.82) / 0.18);
      lookGoal = still ? lookGoal : { x: sweep, y: goal.lookY + (u < 0.82 ? 0 : 0.08) };
      add.y = still ? 0 : -Math.abs(Math.sin(t * 7)) * 0.006 * H;
    }
    if (current === "help") {
      add.rot = wave(1.7, 0.085);
      add.y = wave(3.4, 0.004 * H);
      lookGoal = { x: wave(1.7, 0.12), y: 0.05 };
    }
    if (current === "success" && !still) {
      // hop: crouch, launch, airborne, land with a squash
      const u = (t % 1.05) / 1.05;
      if (u < 0.15) {
        const c = Math.sin((u / 0.15) * Math.PI);
        add.sy = -0.07 * c;
        add.sx = 0.05 * c;
      } else if (u < 0.7) {
        const a = (u - 0.15) / 0.55;
        add.y = -0.11 * H * 4 * a * (1 - a);
        add.sy = 0.05 * (1 - Math.abs(2 * a - 1));
        add.sx = -add.sy * 0.6;
      } else if (u < 0.85) {
        const c = Math.sin(((u - 0.7) / 0.15) * Math.PI);
        add.sy = -0.09 * c;
        add.sx = 0.07 * c;
      }
    }
    if (current === "sad") {
      add.rot = wave(0.9, 0.02);
      add.y = wave(0.9, 0.003 * H, 1);
      lookGoal = { x: goal.lookX + wave(0.5, 0.15), y: goal.lookY };
    }

    for (const k of Object.keys(BASE_POSE)) {
      if (k === "lookX" || k === "lookY") continue;
      pose[k] = approach(pose[k], goal[k], POSE_RATE, dt);
    }
    look.x = approach(look.x, lookGoal.x, LOOK_RATE, dt);
    look.y = approach(look.y, lookGoal.y, LOOK_RATE, dt);
    pose.lookX = look.x;
    pose.lookY = look.y;
    return {
      ...pose,
      x: pose.x + add.x,
      y: pose.y * H + add.y,
      sx: pose.sx + add.sx,
      sy: pose.sy + add.sy,
      rot: pose.rot + add.rot,
    };
  }

  function blinkAmount(dt) {
    if (current === "success" || reducedMotion()) return 0;
    if (blinkT < 0) {
      blinkAt -= dt * (current === "work" ? 1.6 : 1);
      if (blinkAt <= 0) {
        blinkT = 0;
        blinkAt = rand(...BLINK_GAP);
      }
      return 0;
    }
    blinkT += dt;
    if (blinkT > BLINK_SECONDS) {
      blinkT = -1;
      if (Math.random() < DOUBLE_BLINK_CHANCE) blinkAt = DOUBLE_BLINK_GAP;
      return 0;
    }
    return Math.sin((blinkT / BLINK_SECONDS) * Math.PI);
  }

  function draw(p, blink) {
    const k = canvas.width / viewW;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(k, 0, 0, k, -VIEW.left * W * k, -VIEW.top * H * k);

    const px = PIVOT.x * W;
    const py = PIVOT.y * H;
    const lift = Math.max(0, -p.y / (0.11 * H));

    // ground shadow shrinks as the acorn lifts off
    g.fillStyle = SHADOW;
    g.globalAlpha = 1 - lift * 0.5;
    g.beginPath();
    g.ellipse(px, py + 0.01 * H, 0.3 * W * (1 - lift * 0.35), 0.035 * H, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;

    g.save();
    g.translate(px + p.x, py + p.y);
    g.rotate(p.rot);
    g.scale(p.sx, p.sy);
    g.translate(-px, -py);
    g.drawImage(body.img, 0, 0, W, H);
    drawEye(g, body, EYE_L.x * W, EYE_L.y * H, -1, p, blink);
    drawEye(g, body, EYE_R.x * W, EYE_R.y * H, 1, p, blink);

    if (fx.tear > 0.01) {
      const u = (t % 2.6) / 2.6;
      const grow = smooth(u / 0.18);
      const slide = smooth((u - 0.18) / 0.55);
      const fade = 1 - smooth((u - 0.62) / 0.2);
      tearDrop(
        g,
        (EYE_L.x - EYE_RX * 0.55) * W,
        EYE_L.y * H + EYE_RY * W * 0.9 + slide * 0.16 * H,
        0.03 * W * grow,
        fx.tear * fade,
      );
    }
    g.restore();

    if (fx.sparkles > 0.01) {
      const spots = [
        [0.1, 0.18, 0],
        [0.92, 0.3, 1.7],
        [0.96, 0.72, 3.1],
        [0.04, 0.62, 4.4],
        [0.78, -0.05, 5.6],
      ];
      for (const [sx, sy, ph] of spots) {
        const tw = Math.max(0, Math.sin(t * 3.2 + ph));
        sparkle(g, sx * W, sy * H + p.y * 0.4, 0.06 * W * tw, fx.sparkles);
      }
    }
    if (fx.thought > 0.01) {
      const u = (t % 2.4) / 2.4;
      const dots = [
        [0.86, 0.06, 0.03],
        [0.98, -0.05, 0.045],
        [1.12, -0.17, 0.065],
      ];
      dots.forEach(([dx, dy, r], i) => {
        const on = smooth((u - i * 0.18) / 0.12) * (1 - smooth((u - 0.85) / 0.15));
        bubble(g, dx * W, dy * H + p.y, r * W * (0.6 + 0.4 * on), fx.thought * on);
      });
    }
    if (fx.question > 0.01) {
      const bx = 1.08 * W;
      const by = -0.08 * H + Math.sin(t * 2.4) * 0.012 * H;
      const r = 0.12 * W;
      bubble(g, 0.9 * W, 0.08 * H, 0.03 * W, fx.question);
      bubble(g, bx, by, r, fx.question);
      g.globalAlpha = fx.question;
      g.fillStyle = INK;
      g.font = `700 ${Math.round(r * 1.25)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("?", bx, by + r * 0.06);
      g.globalAlpha = 1;
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000) * speed;
    last = now;
    t += dt;
    const target = { thought: 0, question: 0, sparkles: 0, tear: 0, ...EFFECTS[current] };
    for (const k of Object.keys(fx)) fx[k] = approach(fx[k], target[k], FX_RATE, dt);
    const p = livePose(dt);
    draw(p, blinkAmount(dt));
    raf = requestAnimationFrame(frame);
  }

  resize();
  raf = requestAnimationFrame(frame);

  return {
    setStatus(id) {
      if (!POSES[id] || id === current) return;
      current = id;
      if (id === "idle") glanceAt = 0;
    },
    /** Playback speed multiplier (1 = normal). */
    setSpeed(v) {
      speed = v;
    },
    resize,
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}
