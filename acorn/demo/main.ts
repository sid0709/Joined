// Demo viewer for @acorn/face. Everything animated comes from the package; this file only lays it out.
import {
  ACORN_FACE_MODES,
  mount,
  type AcornFaceHandle,
  type AcornFaceMode,
  type AcornFaceRenderer,
} from "@acorn/face";

const LABELS: Record<AcornFaceMode, string> = {
  waiting: "Waiting",
  thinking: "Thinking",
  working: "Working",
  help: "Help",
  smile: "Smile",
  wink: "Wink",
  sad: "Sad",
  sleeping: "Sleeping",
};
const STAGE_PX = 360;
/** The sizes the extension uses: Help page, card, header, list badge. */
const PRODUCT_SIZES = [148, 32, 28, 18];
const GALLERY_PX = 148;
const STRESS_PX = 18;
const PERF_SAMPLE_MS = 1000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage");
const sizes = $("sizes");
const moods = $("moods");
const gallery = $("gallery");
const stress = $("stress");
const bg = $<HTMLSelectElement>("bg");
const rendererPick = $<HTMLSelectElement>("renderer");
const reduced = $<HTMLInputElement>("reduced");
const stressCount = $<HTMLInputElement>("stressCount");
const stressOut = $("stressOut");
const perf = $("perf");

let mood: AcornFaceMode = "waiting";
let faces: AcornFaceHandle[] = [];
let galleryFaces: AcornFaceHandle[] = [];
let stressFaces: AcornFaceHandle[] = [];

function options() {
  return { renderer: rendererPick.value as AcornFaceRenderer, reducedMotion: reduced.checked };
}

function figure(
  parent: HTMLElement,
  px: number,
  caption: string,
  faceMode: AcornFaceMode,
): AcornFaceHandle {
  const fig = document.createElement("figure");
  const host = document.createElement("div");
  host.className = `face bg-${bg.value}`;
  fig.append(host, caption);
  parent.append(fig);
  return mount(host, { size: px, mode: faceMode, ...options() });
}

/** (Re)mount every face, e.g. after switching renderer or reduced motion. */
function build() {
  for (const f of [...faces, ...galleryFaces]) f.destroy();
  stage.replaceChildren();
  sizes.replaceChildren();
  gallery.replaceChildren();
  faces = [mount(stage, { size: STAGE_PX, mode: mood, ...options() })];
  for (const px of PRODUCT_SIZES) faces.push(figure(sizes, px, `${px}px`, mood));
  galleryFaces = ACORN_FACE_MODES.map((m) => figure(gallery, GALLERY_PX, LABELS[m], m));
  buildStress();
}

function select(m: AcornFaceMode) {
  mood = m;
  for (const f of faces) f.setMode(m);
  for (const b of moods.children)
    b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.mode === m));
}

function buildStress() {
  for (const f of stressFaces) f.destroy();
  stress.replaceChildren();
  const n = Number(stressCount.value);
  stressOut.textContent = String(n);
  stressFaces = Array.from({ length: n }, (_, i) => {
    const host = document.createElement("div");
    host.className = "face";
    stress.append(host);
    return mount(host, {
      size: STRESS_PX,
      mode: ACORN_FACE_MODES[i % ACORN_FACE_MODES.length],
      ...options(),
    });
  });
}

/** Page frame rate and worst frame, so renderer choices can be compared under load. */
function watchPerf() {
  let frames = 0;
  let worst = 0;
  let last = performance.now();
  let windowStart = last;
  const loop = (now: number) => {
    frames++;
    worst = Math.max(worst, now - last);
    last = now;
    if (now - windowStart >= PERF_SAMPLE_MS) {
      const fps = Math.round((frames * 1000) / (now - windowStart));
      perf.textContent = `${fps} fps · worst frame ${worst.toFixed(1)} ms · ${stressFaces.length + faces.length + ACORN_FACE_MODES.length} faces`;
      frames = 0;
      worst = 0;
      windowStart = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

for (const m of ACORN_FACE_MODES) {
  const b = document.createElement("button");
  b.textContent = LABELS[m];
  b.dataset.mode = m;
  b.addEventListener("click", () => select(m));
  moods.append(b);
}
document.addEventListener("keydown", (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= ACORN_FACE_MODES.length) select(ACORN_FACE_MODES[n - 1]);
});
bg.addEventListener("change", () => {
  for (const el of document.querySelectorAll<HTMLElement>(".face")) {
    if (el.parentElement === stress) continue;
    el.classList.remove("bg-checker", "bg-light", "bg-dark");
    el.classList.add(`bg-${bg.value}`);
  }
});
rendererPick.addEventListener("change", build);
reduced.addEventListener("change", build);
stressCount.addEventListener("change", buildStress);
stressCount.addEventListener("input", () => {
  stressOut.textContent = stressCount.value;
});

build();
select(mood);
watchPerf();
