// Body art and per-size sprite caches. Works on the main thread and inside the render worker.
import {
  IRIS,
  IRIS_STOPS,
  PUPIL,
  HIGHLIGHT,
  HIGHLIGHT_SOFT,
  SCLERA,
  SKIN_SAMPLE,
} from "./constants";

export type Canvas2D = CanvasRenderingContext2D;
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface BodyArt {
  image: ImageBitmap;
  W: number;
  H: number;
  skin: string;
  skinLight: string;
  skinDark: string;
}

export function makeCanvas(w: number, h: number): AnyCanvas {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export function context2d(c: AnyCanvas): Canvas2D {
  return c.getContext("2d") as Canvas2D;
}

/** Decode the body once and read its skin tone for the eyelids. */
export async function decodeBody(blob: Blob): Promise<BodyArt> {
  const image = await createImageBitmap(blob, { premultiplyAlpha: "premultiply" });
  const W = image.width;
  const H = image.height;
  const r = Math.max(2, Math.round(W * 0.02));
  const probe = makeCanvas(r * 2, r * 2);
  const g = context2d(probe);
  g.drawImage(
    image,
    SKIN_SAMPLE.x * W - r,
    SKIN_SAMPLE.y * H - r,
    r * 2,
    r * 2,
    0,
    0,
    r * 2,
    r * 2,
  );
  const d = g.getImageData(0, 0, r * 2, r * 2).data;
  let [R, G, B, n] = [0, 0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 200) {
      R += d[i];
      G += d[i + 1];
      B += d[i + 2];
      n++;
    }
  }
  const skin = n ? [R / n, G / n, B / n] : [200, 140, 90];
  const shade = (k: number) =>
    `rgb(${skin.map((v) => Math.min(255, Math.round(v * k))).join(",")})`;
  return { image, W, H, skin: shade(1), skinLight: shade(1.06), skinDark: shade(0.78) };
}

export interface EyeSprites {
  sclera: AnyCanvas;
  iris: AnyCanvas;
}

/**
 * Pre-rendered pieces shared by every face of the same size: the body scaled to its exact
 * device size (so drawing is a near 1:1 copy) and the eye's gradients (built once, not per frame).
 */
export class Sprites {
  private bodies = new Map<string, ImageBitmap>();
  private eyes = new Map<string, EyeSprites>();

  constructor(private art: BodyArt) {}

  private scaling = new Map<string, Promise<void>>();

  /** The body at w×h device px, or null while it's being scaled (draw the original meanwhile). */
  body(w: number, h: number, onReady: () => void): ImageBitmap | null {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    if (width >= this.art.W) return this.art.image;
    const key = `${width}x${height}`;
    const hit = this.bodies.get(key);
    if (hit) return hit;
    this.bodyReady(width, height).then(onReady);
    return null;
  }

  /** Resolves once the body is scaled to w×h device px. */
  bodyReady(w: number, h: number): Promise<void> {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    if (width >= this.art.W) return Promise.resolve();
    const key = `${width}x${height}`;
    let pending = this.scaling.get(key);
    if (!pending) {
      pending = createImageBitmap(this.art.image, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      })
        .then((bmp) => {
          this.bodies.set(key, bmp);
        })
        .catch(() => {
          this.bodies.set(key, this.art.image);
        });
      this.scaling.set(key, pending);
    }
    return pending;
  }

  /** Sclera and iris for an eye of rx×ry device px. */
  eye(rx: number, ry: number): EyeSprites {
    const key = `${Math.round(rx * 2)}x${Math.round(ry * 2)}`;
    const hit = this.eyes.get(key);
    if (hit) return hit;

    const sclera = makeCanvas(rx * 2, ry * 2);
    const sg = context2d(sclera);
    const sw = sclera.width;
    const sh = sclera.height;
    const grad = sg.createRadialGradient(sw * 0.38, sh * 0.32, 0, sw / 2, sh / 2, sh * 0.58);
    grad.addColorStop(0, SCLERA[0]);
    grad.addColorStop(0.7, SCLERA[1]);
    grad.addColorStop(1, SCLERA[2]);
    sg.fillStyle = grad;
    sg.fillRect(0, 0, sw, sh);

    const ir = rx * IRIS;
    const iris = makeCanvas(ir * 2, ir * 2);
    const ig = context2d(iris);
    const c = iris.width / 2;
    const irisGrad = ig.createRadialGradient(c, c + c * 0.45, c * 0.1, c, c, c);
    irisGrad.addColorStop(0, IRIS_STOPS[0]);
    irisGrad.addColorStop(0.55, IRIS_STOPS[1]);
    irisGrad.addColorStop(1, IRIS_STOPS[2]);
    ig.fillStyle = irisGrad;
    ig.beginPath();
    ig.arc(c, c, c, 0, Math.PI * 2);
    ig.fill();
    ig.fillStyle = PUPIL;
    ig.beginPath();
    ig.arc(c, c - c * 0.04, c * 0.56, 0, Math.PI * 2);
    ig.fill();
    ig.fillStyle = HIGHLIGHT;
    ig.beginPath();
    ig.arc(c - c * 0.33, c - c * 0.38, c * 0.27, 0, Math.PI * 2);
    ig.fill();
    ig.fillStyle = HIGHLIGHT_SOFT;
    ig.beginPath();
    ig.arc(c + c * 0.32, c + c * 0.3, c * 0.1, 0, Math.PI * 2);
    ig.fill();

    const sprites = { sclera, iris };
    this.eyes.set(key, sprites);
    return sprites;
  }
}
