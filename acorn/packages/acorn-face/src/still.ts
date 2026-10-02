import { mainStage } from "./host/main-host";
import { Face } from "./rig/face";
import type { AcornFaceFraming, AcornFaceMode } from "./types";

/**
 * Draw one still frame of a mood's resting pose (no motion), e.g. for toolbar icons
 * or `chrome.action.setIcon`. Returns a canvas of sizePx × dpr device pixels.
 */
export async function renderStill(
  mode: AcornFaceMode,
  sizePx: number,
  { dpr = 1, framing = "auto" }: { dpr?: number; framing?: AcornFaceFraming } = {},
): Promise<HTMLCanvasElement> {
  const { art, sprites } = await mainStage().ready;
  const canvas = document.createElement("canvas");
  const face = new Face(
    canvas,
    art,
    sprites,
    { mode, cssSize: sizePx, dpr, reducedMotion: true, framing },
    () => {},
  );
  await face.prepare();
  face.paint();
  return canvas;
}
