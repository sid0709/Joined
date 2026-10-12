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

/** The save-wall copy is on screen (offsetParent / computed), not just in the HTML. */
export function hasVisibleSignUpModal(html) {
  if (!html || !SIGN_UP_MODAL_RE.test(html)) return false;
  return smallestTextMatches(documentFromHtml(html), SIGN_UP_MODAL_RE).some((el) =>
    isVisibleElement(el),
  );
}

function flaggedLoggedIn({ html = "", isLoggedIn } = {}) {
  if (typeof isLoggedIn === "boolean") return isLoggedIn;
  const board = parseJobBoardInit(html);
  if (typeof board?.isLoggedIn === "boolean") return board.isLoggedIn;
  const init = parseJobPostInit(html);
  if (typeof init?.isLoggedIn === "boolean") return init.isLoggedIn;
  return undefined;
}

/**
 * Prefer an explicit / jobPostInit / jobBoardInit `isLoggedIn`. `false` is
 * signed out. A visible save-wall modal still stops a session; hidden copy does not.
 */
export function isSignedOutSession({ html = "", isLoggedIn } = {}) {
  const flagged = flaggedLoggedIn({ html, isLoggedIn });
  if (flagged === false) return true;
  return hasVisibleSignUpModal(html);
}
