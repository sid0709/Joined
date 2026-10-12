import { queryAll } from "../../routineKit/extract.js";

import { SIGN_UP_MODAL_TEXT } from "./constants.js";
import { documentFromHtml } from "./html.js";
import { parseJobBoardInit, parseJobPostInit } from "./parseInit.js";
import { isVisibleElement } from "./visible.js";

const SIGN_UP_MODAL_RE = new RegExp(SIGN_UP_MODAL_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

function smallestTextMatches(document, re) {
  const matches = queryAll(document, "*").filter((el) => re.test(el.textContent || ""));
  return matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)));
}

/** The save-wall copy is on screen, not just present in the HTML. */
export function hasVisibleSignUpModal(html) {
  if (!html || !SIGN_UP_MODAL_RE.test(html)) return false;
  return smallestTextMatches(documentFromHtml(html), SIGN_UP_MODAL_RE).some((el) =>
    isVisibleElement(el),
  );
}

/**
 * Signed-out Built In: jobPostInit / jobBoardInit `isLoggedIn: false`, or a
 * visible "Sign up now. Access later." modal. Unknown (no init) is not a stop.
 * Hidden modal copy in the HTML is not signed out.
 */
export function isSignedOutSession({ html = "", isLoggedIn } = {}) {
  if (isLoggedIn === false) return true;
  if (hasVisibleSignUpModal(html)) return true;
  const board = parseJobBoardInit(html);
  if (board && board.isLoggedIn === false) return true;
  const init = parseJobPostInit(html);
  return Boolean(init && init.isLoggedIn === false);
}
