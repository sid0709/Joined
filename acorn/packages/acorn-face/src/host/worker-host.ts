// Page side of the render worker. Hands canvases to one shared worker and forwards calls.
import { bodyBlob } from "../rig/body-blob";
import type { FaceController, ToWorker } from "./protocol";
import type { FaceSetup } from "./stage";

let worker: Worker | null | undefined;
let nextId = 1;

function post(msg: ToWorker, transfer: Transferable[] = []): void {
  worker?.postMessage(msg, transfer);
}

/**
 * The shared worker, or null where one can't run. Content scripts are the common case:
 * their code comes from the extension's origin, but workers must match the page's origin.
 */
function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof OffscreenCanvas === "undefined") return null;
    if (!("transferControlToOffscreen" in HTMLCanvasElement.prototype)) return null;
    if (new URL(import.meta.url).origin !== location.origin) return null;
    const w = new Worker(new URL("./render-worker.ts", import.meta.url), { type: "module" });
    worker = w;
    post({ type: "art", body: bodyBlob() });
    document.addEventListener("visibilitychange", () =>
      post({ type: "hidden", hidden: document.hidden }),
    );
    post({ type: "hidden", hidden: document.hidden });
  } catch {
    worker = null;
  }
  return worker;
}

/** Mount on the worker, or return null so the caller can draw on the main thread instead. */
export function mountOnWorker(canvas: HTMLCanvasElement, setup: FaceSetup): FaceController | null {
  if (!getWorker()) return null;
  const id = nextId++;
  const offscreen = canvas.transferControlToOffscreen();
  post({ type: "add", id, canvas: offscreen, ...setup }, [offscreen]);
  return {
    setMode: (mode) => post({ type: "mode", id, mode }),
    setPaused: (paused) => post({ type: "paused", id, paused }),
    setVisible: (visible) => post({ type: "visible", id, visible }),
    resize: (cssSize, dpr) => post({ type: "resize", id, cssSize, dpr }),
    destroy: () => post({ type: "remove", id }),
  };
}
