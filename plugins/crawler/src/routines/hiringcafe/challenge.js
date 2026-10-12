import { detectPageBlock, isTransientBlock } from "../../routineKit/backoff.js";
import { queryAll } from "../../routineKit/extract.js";
import { isVisibleElement } from "../builtin/visible.js";

import { CHALLENGE_TITLE_RE, TURNSTILE_WIDGET } from "./constants.js";
import { documentFromHtml, textOf } from "./html.js";

function challengeTitle(html) {
  if (!html) return false;
  return CHALLENGE_TITLE_RE.test(textOf(documentFromHtml(html).querySelector("title")));
}

function visibleTurnstile(html) {
  if (!html) return false;
  return queryAll(documentFromHtml(html), TURNSTILE_WIDGET).some((node) => isVisibleElement(node));
}

/**
 * Visible Turnstile iframe/widget, or the challenge page title. Never raw
 * HTML — Cloudflare injects challenge-platform scripts on normal pages.
 */
export function isHiringCafeChallenge(page = {}) {
  return visibleTurnstile(page.html) || challengeTitle(page.html);
}

export function detectHiringCafeBlock(page = {}) {
  if (isHiringCafeChallenge(page)) return { blocked: true, kind: "challenge" };
  const detected = detectPageBlock({
    status: page.status,
    url: page.url,
    retryAfter: page.retryAfter,
  });
  if (detected.kind === "challenge") return { blocked: false, kind: "" };
  return detected;
}

export { isTransientBlock };
