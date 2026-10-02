import { mount } from "./engine";
import { BASH_FACE_MODES, type BashFaceMode } from "./types";
import "./demo.css";

const app = document.querySelector("#app");
if (!app) throw new Error("#app missing");

const faceHost = document.createElement("div");
faceHost.className = "face-host";

const panel = document.createElement("div");
panel.className = "panel";

const heading = document.createElement("header");
heading.innerHTML = `
  <p class="eyebrow">@bash/face</p>
  <h1>Lumen face playground</h1>
  <p class="lede">One silhouette. One mode at a time. Nothing here is wired into the live sidebar.</p>
`;

const readout = document.createElement("p");
readout.className = "readout";

const modeRow = chipRow("Mode", BASH_FACE_MODES);

const actions = document.createElement("div");
actions.className = "actions";
const cycleBtn = document.createElement("button");
cycleBtn.type = "button";
cycleBtn.className = "ghost";
cycleBtn.textContent = "Play all";
const restBtn = document.createElement("button");
restBtn.type = "button";
restBtn.className = "ghost";
restBtn.textContent = "Rest (waiting)";
actions.append(cycleBtn, restBtn);

panel.append(heading, readout, modeRow.section, actions);
app.append(faceHost, panel);

const face = mount(faceHost, { size: 420 });
let mode: BashFaceMode = "waiting";
let cycleTimer = 0;

function paint(): void {
  face.setMode(mode);
  readout.textContent = mode;
  modeRow.mark(mode);
}

function chipRow<T extends string>(
  label: string,
  values: readonly T[],
): { section: HTMLElement; mark: (value: T) => void } {
  const section = document.createElement("section");
  section.className = "chip-row";
  const title = document.createElement("h2");
  title.textContent = label;
  const row = document.createElement("div");
  row.className = "chips";
  for (const value of values) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.value = value;
    btn.textContent = value;
    row.appendChild(btn);
  }
  section.append(title, row);
  return {
    section,
    mark(value: T) {
      for (const btn of row.querySelectorAll<HTMLButtonElement>(".chip")) {
        btn.classList.toggle("on", btn.dataset.value === value);
      }
    },
  };
}

modeRow.section.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".chip");
  if (!btn?.dataset.value) return;
  mode = btn.dataset.value as BashFaceMode;
  paint();
});

restBtn.addEventListener("click", () => {
  window.clearInterval(cycleTimer);
  cycleTimer = 0;
  cycleBtn.textContent = "Play all";
  mode = "waiting";
  paint();
});

cycleBtn.addEventListener("click", () => {
  if (cycleTimer) {
    window.clearInterval(cycleTimer);
    cycleTimer = 0;
    cycleBtn.textContent = "Play all";
    return;
  }
  let i = 0;
  const step = () => {
    mode = BASH_FACE_MODES[i % BASH_FACE_MODES.length];
    paint();
    i += 1;
  };
  step();
  cycleTimer = window.setInterval(step, 1600);
  cycleBtn.textContent = "Stop";
});

paint();
