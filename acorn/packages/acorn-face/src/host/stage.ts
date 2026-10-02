// Decoded art, sprite caches, and the scheduler for one thread, plus controllers for its faces.
import { decodeBody, Sprites, type AnyCanvas, type BodyArt } from "../rig/art";
import { Face } from "../rig/face";
import type { AcornFaceMode } from "../types";
import type { FaceController } from "./protocol";
import { Scheduler } from "./scheduler";

export interface FaceSetup {
  cssSize: number;
  dpr: number;
  mode: AcornFaceMode;
  reducedMotion: boolean;
}

export class Stage {
  readonly scheduler = new Scheduler();
  readonly ready: Promise<{ art: BodyArt; sprites: Sprites }>;

  constructor(body: Blob | Promise<Blob>) {
    this.ready = Promise.resolve(body)
      .then(decodeBody)
      .then((art) => ({ art, sprites: new Sprites(art) }));
  }

  /** A controller that works immediately; calls made before the art decodes are replayed. */
  attach(canvas: AnyCanvas, setup: FaceSetup): FaceController {
    const want = { ...setup, paused: false, visible: true, gone: false };
    let face: Face | null = null;

    this.ready.then(({ art, sprites }) => {
      if (want.gone) return;
      face = new Face(canvas, art, sprites, want, this.scheduler.wake);
      face.paused = want.paused;
      face.visible = want.visible;
      this.scheduler.add(face);
    });

    return {
      setMode: (mode) => {
        want.mode = mode;
        face?.setMode(mode);
        this.scheduler.wake();
      },
      setPaused: (paused) => {
        want.paused = paused;
        if (face) face.paused = paused;
        this.scheduler.wake();
      },
      setVisible: (visible) => {
        want.visible = visible;
        if (face) face.visible = visible;
        this.scheduler.wake();
      },
      resize: (cssSize, dpr) => {
        want.cssSize = cssSize;
        want.dpr = dpr;
        if (face) {
          face.resize(cssSize, dpr);
          face.paint();
        }
        this.scheduler.wake();
      },
      destroy: () => {
        want.gone = true;
        if (face) this.scheduler.remove(face);
        face = null;
      },
    };
  }
}
