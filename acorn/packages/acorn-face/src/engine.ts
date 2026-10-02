import { mountOnMain } from "./host/main-host";
import type { FaceController } from "./host/protocol";
import { mountOnWorker } from "./host/worker-host";
import type { AcornFaceHandle, AcornFaceMountOptions } from "./types";

const DEFAULT_SIZE_PX = 280;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Mount an acorn face into `el`. It draws on a shared worker when it can, else on the main thread. */
export function mount(el: HTMLElement, options: AcornFaceMountOptions = {}): AcornFaceHandle {
  const size = options.size ?? DEFAULT_SIZE_PX;
  const css = typeof size === "number" ? `${size}px` : size;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = `display:block;width:${css};height:${css};`;
  el.appendChild(canvas);

  const measured = canvas.getBoundingClientRect().width;
  const setup = {
    cssSize: measured || (typeof size === "number" ? size : DEFAULT_SIZE_PX),
    dpr: window.devicePixelRatio || 1,
    mode: options.mode ?? "waiting",
    reducedMotion: options.reducedMotion ?? window.matchMedia(REDUCED_MOTION).matches,
  } as const;

  const renderer = options.renderer ?? "auto";
  const face: FaceController =
    (renderer !== "main" ? mountOnWorker(canvas, setup) : null) ?? mountOnMain(canvas, setup);

  let cssSize = setup.cssSize;
  let dpr = setup.dpr;
  const resize = () => face.resize(cssSize, dpr);

  const sizeWatch = new ResizeObserver(([entry]) => {
    const w = entry?.contentRect.width;
    if (w && Math.abs(w - cssSize) > 0.5) {
      cssSize = w;
      resize();
    }
  });
  sizeWatch.observe(canvas);

  const onScreen = new IntersectionObserver(([entry]) =>
    face.setVisible(Boolean(entry?.isIntersecting)),
  );
  onScreen.observe(canvas);

  let density: MediaQueryList | null = null;
  const watchDensity = () => {
    density?.removeEventListener("change", onDensity);
    density = window.matchMedia(`(resolution: ${dpr}dppx)`);
    density.addEventListener("change", onDensity);
  };
  function onDensity() {
    dpr = window.devicePixelRatio || 1;
    resize();
    watchDensity();
  }
  watchDensity();

  return {
    setMode: (mode) => face.setMode(mode),
    setPaused: (paused) => face.setPaused(paused),
    destroy: () => {
      sizeWatch.disconnect();
      onScreen.disconnect();
      density?.removeEventListener("change", onDensity);
      face.destroy();
      canvas.remove();
    },
  };
}
