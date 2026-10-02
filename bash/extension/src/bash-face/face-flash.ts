import type { OakFaceMode } from "@oak/face";
import { FACE_SAD_PULSE_MS, FACE_SMILE_MS, FACE_WINK_MS } from "./constants";

export type OakFaceFlash = {
  mode: OakFaceMode;
  ms: number;
};

type Listener = (flash: OakFaceFlash) => void;

const listeners = new Set<Listener>();

export function flashOakFace(flash: OakFaceFlash): void {
  for (const fn of listeners) fn(flash);
}

export function subscribeOakFaceFlash(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function flashFromNotice(kind: "error" | "success" | "info", title?: string): void {
  if (kind === "error") {
    flashOakFace({ mode: "sad", ms: FACE_SAD_PULSE_MS });
    return;
  }
  if (kind === "success" && title === "Connected") {
    flashOakFace({ mode: "wink", ms: FACE_WINK_MS });
    return;
  }
  if (kind === "success") {
    flashOakFace({ mode: "smile", ms: FACE_SMILE_MS });
    return;
  }
  if (title === "Remember this tab first") {
    flashOakFace({ mode: "sad", ms: FACE_SAD_PULSE_MS });
    return;
  }
  flashOakFace({ mode: "wink", ms: FACE_WINK_MS });
}
