import { queryAll } from "../../routineKit/extract.js";
import { findMarkAppliedControl } from "../../routines/hiringcafe/appliedState.js";
import { MARK_APPLIED_TEXT } from "../../routines/hiringcafe/constants.js";

import { preventLinkNavigation } from "./dom";
import { pickMatch } from "./hoverClick";

export const GUARD_MARK_LINK_OP = "guardMarkLink";
export const RELEASE_MARK_LINK_OP = "releaseMarkLink";

let releaseGuard = null;

export function releaseMarkLinkGuard() {
  releaseGuard?.();
  releaseGuard = null;
  return { released: true };
}

export function installMarkLinkGuard(root, payload = {}) {
  releaseMarkLinkGuard();
  const { selector, clickSelector, nth = 0, contains, exact = false } = payload;
  const cards = selector ? queryAll(root, selector) : [];
  const scope = cards[nth] || root;
  const needle = String(contains || "").trim();
  const target =
    (needle === MARK_APPLIED_TEXT || !needle ? findMarkAppliedControl(scope) : null) ||
    pickMatch(queryAll(scope, clickSelector || selector || "*"), { contains: needle, exact });
  if (!target) return { guarded: false };
  releaseGuard = preventLinkNavigation(target);
  return { guarded: true };
}
