import { queryAll } from "../../routineKit/extract.js";

import {
  APPLY_UNAUTH,
  BUILTIN_ORIGIN,
  HEADER_LOGIN_TEXT_RE,
  LOGIN_PATH_PREFIX,
  SIGN_UP_MODAL_TEXT,
} from "./constants.js";
import { documentFromHtml, textOf } from "./html.js";
import { parseJobBoardInit, parseJobPostInit } from "./parseInit.js";

const SIGN_UP_MODAL_RE = new RegExp(SIGN_UP_MODAL_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

function hrefLooksLikeLogin(href) {
  if (!href) return false;
  try {
    const path = new URL(href, BUILTIN_ORIGIN).pathname.toLowerCase();
    return path === LOGIN_PATH_PREFIX || path.startsWith(`${LOGIN_PATH_PREFIX}/`);
  } catch {
    return String(href).toLowerCase().includes(LOGIN_PATH_PREFIX);
  }
}

/**
 * Built In header Sign In / Log In. Ignore the job-page "Log In to apply" link.
 */
export function hasHeaderLoginLink(html) {
  if (!html) return false;
  const document = documentFromHtml(html);
  for (const anchor of queryAll(document, "a[href]")) {
    if (!hrefLooksLikeLogin(anchor.getAttribute("href") || anchor.href)) continue;
    if (anchor.matches?.(APPLY_UNAUTH)) continue;
    if (HEADER_LOGIN_TEXT_RE.test(textOf(anchor))) return true;
  }
  return false;
}

/**
 * Signed-out Built In: jobPostInit / jobBoardInit `isLoggedIn: false`, the
 * "Sign up now. Access later." save-wall modal, or a header login link.
 * Unknown (no init) is not a stop.
 */
export function isSignedOutSession({ html = "", isLoggedIn } = {}) {
  if (isLoggedIn === false) return true;
  if (SIGN_UP_MODAL_RE.test(html)) return true;
  if (hasHeaderLoginLink(html)) return true;
  const board = parseJobBoardInit(html);
  if (board && board.isLoggedIn === false) return true;
  const init = parseJobPostInit(html);
  return Boolean(init && init.isLoggedIn === false);
}
