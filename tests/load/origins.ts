import { PRODUCTION_HOST } from "./thresholds.ts";

export function assertSafeOrigin(origin: string): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`invalid origin: ${origin}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`origin must be http(s): ${origin}`);
  }
  const host = url.hostname.toLowerCase();
  if (host === PRODUCTION_HOST || host.endsWith(`.${PRODUCTION_HOST}`)) {
    throw new Error(`refusing production host ${host}`);
  }
  return url;
}
