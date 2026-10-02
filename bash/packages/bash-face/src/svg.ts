import { EYE_L, EYE_R, EYE_RADIUS, HEAD_PATH, HEAD_VIEW } from "./geometry";
import { FUR_STOP_OFFSETS, MODE_PALETTES } from "./palettes";

const NS = "http://www.w3.org/2000/svg";
let faceSerial = 0;

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

export interface OakFaceSvg {
  root: SVGSVGElement;
  head: SVGGElement;
  eyeL: SVGGElement;
  eyeR: SVGGElement;
  applyFur(fur: readonly string[]): void;
}

export function createFaceSvg(): OakFaceSvg {
  const uid = `oak-face-${++faceSerial}`;
  const furId = `${uid}-fur`;
  const grainId = `${uid}-grain`;

  const root = el("svg", {
    viewBox: `${HEAD_VIEW.x} ${HEAD_VIEW.y} ${HEAD_VIEW.size} ${HEAD_VIEW.size}`,
    xmlns: NS,
    role: "img",
    "aria-label": "Oak face",
  });
  root.style.display = "block";
  root.style.overflow = "visible";

  const defs = el("defs");

  const waiting = MODE_PALETTES.waiting;
  const fur = el("linearGradient", {
    id: furId,
    gradientUnits: "userSpaceOnUse",
    x1: "106",
    y1: "493",
    x2: "494",
    y2: "120",
  });
  const furStops = FUR_STOP_OFFSETS.map((offset, i) =>
    el("stop", { offset, "stop-color": waiting.fur[i] }),
  );
  fur.append(...furStops);

  const grain = el("filter", {
    id: grainId,
    x: "-8%",
    y: "-8%",
    width: "116%",
    height: "116%",
    filterUnits: "objectBoundingBox",
    "color-interpolation-filters": "sRGB",
  });
  grain.appendChild(
    el("feTurbulence", {
      type: "fractalNoise",
      baseFrequency: "0.85",
      numOctaves: 3,
      seed: 4,
      result: "noise",
    }),
  );
  grain.appendChild(
    el("feColorMatrix", {
      in: "noise",
      type: "saturate",
      values: "0",
      result: "mono",
    }),
  );
  const transfer = el("feComponentTransfer", { in: "mono", result: "grain" });
  transfer.appendChild(el("feFuncA", { type: "table", tableValues: "0 0.38" }));
  grain.appendChild(transfer);
  grain.appendChild(
    el("feComposite", {
      in: "grain",
      in2: "SourceAlpha",
      operator: "in",
      result: "clippedGrain",
    }),
  );
  grain.appendChild(
    el("feBlend", {
      in: "SourceGraphic",
      in2: "clippedGrain",
      mode: "overlay",
      result: "blended",
    }),
  );
  grain.appendChild(
    el("feComposite", {
      in: "blended",
      in2: "SourceAlpha",
      operator: "in",
    }),
  );

  defs.append(fur, grain);
  root.appendChild(defs);

  const head = el("g", { class: "oak-face-head" });
  head.appendChild(
    el("path", {
      class: "oak-face-body",
      d: HEAD_PATH,
      fill: `url(#${furId})`,
      filter: `url(#${grainId})`,
    }),
  );

  const eyeL = el("g", { class: "oak-face-eye-l" });
  eyeL.appendChild(
    el("ellipse", {
      cx: EYE_L.x,
      cy: EYE_L.y,
      rx: EYE_RADIUS,
      ry: EYE_RADIUS,
      fill: "#ffffff",
    }),
  );

  const eyeR = el("g", { class: "oak-face-eye-r" });
  eyeR.appendChild(
    el("ellipse", {
      cx: EYE_R.x,
      cy: EYE_R.y,
      rx: EYE_RADIUS,
      ry: EYE_RADIUS,
      fill: "#ffffff",
    }),
  );

  head.append(eyeL, eyeR);
  root.appendChild(head);

  return {
    root,
    head,
    eyeL,
    eyeR,
    applyFur(furColors) {
      for (let i = 0; i < furStops.length; i += 1) {
        furStops[i].setAttribute("stop-color", furColors[i]);
      }
    },
  };
}
