import type { BashFaceMode } from "@bash/face";
import { FACE_SAD_PULSE_MS, FACE_SMILE_MS, FACE_WINK_MS } from "./constants";

export type BashFaceFlash = {
  mode: BashFaceMode;
  ms: number;
};

type Listener = (flash: BashFaceFlash) => void;

const listeners = new Set<Listener>();

export function flashBashFace(flash: BashFaceFlash): void {
  for (const fn of listeners) fn(flash);
}

export function subscribeBashFaceFlash(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function flashFromNotice(kind: "error" | "success" | "info", title?: string): void {
  if (kind === "error") {
    flashBashFace({ mode: "sad", ms: FACE_SAD_PULSE_MS });
    return;
  }
  if (kind === "success" && title === "Connected") {
    flashBashFace({ mode: "wink", ms: FACE_WINK_MS });
    return;
  }
  if (kind === "success") {
    flashBashFace({ mode: "smile", ms: FACE_SMILE_MS });
    return;
  }
  if (title === "Remember this tab first") {
    flashBashFace({ mode: "sad", ms: FACE_SAD_PULSE_MS });
    return;
  }
  flashBashFace({ mode: "wink", ms: FACE_WINK_MS });
}
