// The embedded body as a Blob. Page-side only: the render worker receives this Blob by message,
// so the image data isn't bundled into the worker twice.
import { BODY_BASE64, BODY_MIME } from "../assets/body";

let blob: Blob | null = null;

export function bodyBlob(): Blob {
  if (blob) return blob;
  const bin = atob(BODY_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  blob = new Blob([bytes], { type: BODY_MIME });
  return blob;
}
