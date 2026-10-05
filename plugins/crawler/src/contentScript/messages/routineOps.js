import { extractField, queryAll, waitForMatches } from "../../routineKit/extract.js";
import { clickLikeHuman } from "../actions/dom";
import { clearHighlights, highlightElements } from "../highlighter";

// The page side of the routine runner (routineKit/runner.js): each op does one thing to
// the live page and answers with its result.
const OPS = {
  count: ({ selector }) => ({ count: queryAll(document, selector).length }),
  highlight: ({ selector }) => highlightElements(queryAll(document, selector)),
  clear: () => {
    clearHighlights();
    return {};
  },
  click: async ({ selector, nth = 0, wait = 0 }) => {
    const target = (await waitForMatches(document, selector, wait))[nth];
    if (!target) return { found: false };
    // clickLikeHuman scrolls only when needed; skip focus()'s own scroll-into-view.
    target.focus?.({ preventScroll: true });
    clickLikeHuman(target);
    return { found: true };
  },
  extract: async ({ field }) => {
    await waitForMatches(document, field.selector, field.wait);
    return extractField(document, field);
  },
};

export function handleRoutineOp(payload, sendResponse) {
  const run = OPS[payload?.op];
  if (!run) {
    sendResponse({ success: false, error: `Unknown routine op: ${payload?.op}` });
    return;
  }
  Promise.resolve()
    .then(() => run(payload))
    .then(
      (result) => sendResponse({ success: true, result }),
      (error) => sendResponse({ success: false, error: String(error?.message || error) }),
    );
}
