import type { AcornFaceMode } from "@acorn/face";
import { FACE_SAD_PULSE_MS, FACE_SMILE_MS, FACE_WINK_MS } from "./constants";

export type AcornFaceFlash = {
  mode: AcornFaceMode;
  ms: number;
};

type Listener = (flash: AcornFaceFlash) => void;

const listeners = new Set<Listener>();

export function flashAcornFace(flash: AcornFaceFlash): void {
  for (const fn of listeners) fn(flash);
}

export function subscribeAcornFaceFlash(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function flashFromNotice(kind: "error" | "success" | "info", title?: string): void {
  if (kind === "error") {
    flashAcornFace({ mode: "sad", ms: FACE_SAD_PULSE_MS });
    return;
  }
  if (kind === "success" && title === "Connected") {
    flashAcornFace({ mode: "wink", ms: FACE_WINK_MS });
    return;
  }
  if (kind === "success") {
    flashAcornFace({ mode: "smile", ms: FACE_SMILE_MS });
    return;
  }
  if (title === "Remember this tab first") {
    flashAcornFace({ mode: "sad", ms: FACE_SAD_PULSE_MS });
    return;
  }
  flashAcornFace({ mode: "wink", ms: FACE_WINK_MS });
}
