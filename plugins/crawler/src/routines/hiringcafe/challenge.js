import { detectPageBlock, isTransientBlock } from "../../routineKit/backoff.js";

const TURNSTILE_RE =
  /cf-turnstile|cf-challenge|challenge-platform|just a moment|performing security verification|verify you are (a )?human/i;

/** Cloudflare Turnstile / managed challenge on a visible HiringCafe page. */
export function isHiringCafeChallenge(page = {}) {
  const detected = detectPageBlock(page);
  if (detected.kind === "challenge") return true;
  return Boolean(page.html && TURNSTILE_RE.test(page.html));
}

export function detectHiringCafeBlock(page = {}) {
  if (isHiringCafeChallenge(page)) return { blocked: true, kind: "challenge" };
  return detectPageBlock(page);
}

export { isTransientBlock };
