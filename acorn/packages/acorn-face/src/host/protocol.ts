import type { AcornFaceMode } from "../types";

/** Messages from the page to the render worker. */
export type ToWorker =
  | { type: "art"; body: Blob }
  | {
      type: "add";
      id: number;
      canvas: OffscreenCanvas;
      cssSize: number;
      dpr: number;
      mode: AcornFaceMode;
      reducedMotion: boolean;
    }
  | { type: "mode"; id: number; mode: AcornFaceMode }
  | { type: "paused"; id: number; paused: boolean }
  | { type: "visible"; id: number; visible: boolean }
  | { type: "resize"; id: number; cssSize: number; dpr: number }
  | { type: "remove"; id: number }
  | { type: "hidden"; hidden: boolean };

/** One mounted face, whichever thread draws it. */
export interface FaceController {
  setMode(mode: AcornFaceMode): void;
  setPaused(paused: boolean): void;
  setVisible(visible: boolean): void;
  resize(cssSize: number, dpr: number): void;
  destroy(): void;
}
