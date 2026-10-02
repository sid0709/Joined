// One frame loop for every face on a thread. Each face is updated at its own frame-rate cap,
// hidden or paused faces cost nothing, and the loop stops entirely when nothing animates.
import { MAX_STEP_SECONDS } from "../rig/constants";
import type { Face } from "../rig/face";

/** Treat a face as due slightly early so a 30fps cap doesn't slip to 20fps on 60Hz frames. */
const FRAME_SLACK_MS = 2;

type FrameFn = (cb: (now: number) => void) => number;
type CancelFn = (id: number) => void;

const raf: FrameFn =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const caf: CancelFn =
  typeof cancelAnimationFrame === "function"
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

export class Scheduler {
  private faces = new Set<Face>();
  private frame = 0;
  private hidden = false;

  add(face: Face): void {
    this.faces.add(face);
    face.paint();
    this.wake();
  }

  remove(face: Face): void {
    this.faces.delete(face);
  }

  /** Page hidden: stop drawing everything until it's visible again. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!hidden) this.wake();
  }

  /** Start the loop if any face needs frames. Cheap to call often. */
  wake = (): void => {
    if (this.frame || this.hidden) return;
    for (const f of this.faces) {
      if (this.live(f)) {
        this.frame = raf(this.tick);
        return;
      }
    }
  };

  private live(f: Face): boolean {
    return !f.paused && f.visible && f.animating;
  }

  private tick = (now: number): void => {
    this.frame = 0;
    if (this.hidden) return;
    let any = false;
    for (const f of this.faces) {
      if (!this.live(f)) {
        f.lastTick = -Infinity;
        continue;
      }
      any = true;
      const since = now - f.lastTick;
      if (since < 1000 / f.fps - FRAME_SLACK_MS) continue;
      f.lastTick = now;
      f.step(Math.min(MAX_STEP_SECONDS, Number.isFinite(since) ? since / 1000 : 0));
    }
    if (any) this.frame = raf(this.tick);
  };

  /** For tests and teardown. */
  stop(): void {
    if (this.frame) caf(this.frame);
    this.frame = 0;
  }
}
