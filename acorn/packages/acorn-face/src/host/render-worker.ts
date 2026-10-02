// Render worker: draws every face on the page off the main thread, into OffscreenCanvases
// the page hands over. One worker serves all faces, so art and sprites are shared.
import type { FaceController, ToWorker } from "./protocol";
import { Stage } from "./stage";

const scope = self as unknown as { onmessage: ((e: MessageEvent<ToWorker>) => void) | null };
let stage: Stage | null = null;
const faces = new Map<number, FaceController>();

scope.onmessage = ({ data: msg }) => {
  if (msg.type === "art") {
    stage = new Stage(msg.body);
    return;
  }
  if (msg.type === "hidden") {
    stage?.scheduler.setHidden(msg.hidden);
    return;
  }
  if (msg.type === "add") {
    if (!stage) return;
    faces.set(msg.id, stage.attach(msg.canvas, msg));
    return;
  }
  const face = faces.get(msg.id);
  if (!face) return;
  switch (msg.type) {
    case "mode":
      face.setMode(msg.mode);
      break;
    case "paused":
      face.setPaused(msg.paused);
      break;
    case "visible":
      face.setVisible(msg.visible);
      break;
    case "resize":
      face.resize(msg.cssSize, msg.dpr);
      break;
    case "remove":
      face.destroy();
      faces.delete(msg.id);
      break;
  }
};
