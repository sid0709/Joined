// Main-thread rendering: used where a worker can't run (content scripts on other sites,
// browsers without OffscreenCanvas) and for still renders.
import { bodyBlob } from "../rig/body-blob";
import type { FaceController } from "./protocol";
import { Stage, type FaceSetup } from "./stage";

let stage: Stage | null = null;

export function mainStage(): Stage {
  if (stage) return stage;
  const s = new Stage(bodyBlob());
  stage = s;
  document.addEventListener("visibilitychange", () => s.scheduler.setHidden(document.hidden));
  s.scheduler.setHidden(document.hidden);
  return s;
}

export function mountOnMain(canvas: HTMLCanvasElement, setup: FaceSetup): FaceController {
  return mainStage().attach(canvas, setup);
}
