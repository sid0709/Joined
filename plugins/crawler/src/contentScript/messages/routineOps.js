import { clickSaveInDocument } from "../../background/messages/shadowClick.js";
import { extractField, queryAll, waitForMatches } from "../../routineKit/extract.js";
import { assertFetchUrl, hostMatches } from "../../routineKit/match.js";
import { BUILTIN_HOSTS } from "../../routines/builtin/constants.js";
import { clickLikeHuman } from "../actions/dom";
import { hoverAt, hoverClickInDocument, pickMatch } from "../actions/hoverClick";
import { hoverTargetInDocument, waitForOverlayTarget } from "../actions/hoverTarget";
import {
  GUARD_MARK_LINK_OP,
  RELEASE_MARK_LINK_OP,
  installMarkLinkGuard,
  releaseMarkLinkGuard,
} from "../actions/markLinkGuard";
import { scrollElementIntoView } from "../actions/scroll";
import { clearHighlights, highlightElements } from "../highlighter";

// The page side of the routine runner (routineKit/runner.js): each op does one thing to
// the live page and answers with its result.

const inFlightFetches = new Map();

const OPS = {
  count: ({ selector }) => ({ count: queryAll(document, selector).length }),
  scroll: (payload) => scrollElementIntoView(document, payload),
  highlight: ({ selector }) => highlightElements(queryAll(document, selector)),
  clear: () => {
    clearHighlights();
    return {};
  },
  html: () => ({
    html: document.documentElement?.outerHTML ?? "",
    url: location.href,
  }),
  fetch: async ({ url, hosts, fetchId }) => {
    const resolved = assertFetchUrl(url, hosts, location.href);
    const controller = new AbortController();
    // Built In keys by unique request id. JobRight still keys by URL.
    const id = String(fetchId || "").trim() || resolved;
    inFlightFetches.set(id, controller);
    try {
      const response = await fetch(resolved, {
        credentials: "include",
        signal: controller.signal,
      });
      return {
        html: await response.text(),
        url: response.url,
        status: response.status,
        retryAfter: response.headers.get("Retry-After") || "",
      };
    } finally {
      inFlightFetches.delete(id);
    }
  },
  abortFetches: () => {
    for (const controller of inFlightFetches.values()) controller.abort();
    inFlightFetches.clear();
    return { aborted: true };
  },
  click: async ({ selector, nth = 0, wait = 0, contains, exact = false }) => {
    const matches = await waitForMatches(document, selector, wait);
    const target = pickMatch(matches, { nth, contains, exact });
    if (!target) return { found: false };
    // clickLikeHuman scrolls only when needed; skip focus()'s own scroll-into-view.
    target.focus?.({ preventScroll: true });
    clickLikeHuman(target);
    return { found: true };
  },
  hover: async ({ selector, nth = 0, wait = 0, x = 100, y = 100 }) => {
    const matches = await waitForMatches(document, selector, wait);
    const target = matches[nth];
    if (!target) return { found: false };
    hoverAt(target, { x, y });
    return { found: true };
  },
  hoverClick: async ({
    selector,
    clickSelector,
    nth = 0,
    wait = 0,
    contains,
    exact = false,
    offsets,
  }) => {
    await waitForMatches(document, selector, wait);
    return hoverClickInDocument(document, {
      selector,
      clickSelector,
      nth,
      contains,
      exact,
      offsets,
    });
  },
  hoverTarget: async ({ selector, nth = 0, wait = 0, x = 100, y = 100 }) => {
    await waitForMatches(document, selector, wait);
    return hoverTargetInDocument(document, { selector, nth, x, y });
  },
  overlayTarget: async ({
    selector,
    clickSelector,
    nth = 0,
    wait = 0,
    contains,
    exact = false,
  }) => {
    await waitForMatches(document, selector, 0);
    return waitForOverlayTarget(document, {
      selector,
      clickSelector,
      nth,
      contains,
      exact,
      wait,
    });
  },
  [GUARD_MARK_LINK_OP]: (payload) => installMarkLinkGuard(document, payload),
  [RELEASE_MARK_LINK_OP]: () => releaseMarkLinkGuard(),
  extract: async ({ field }) => {
    await waitForMatches(document, field.selector, field.wait);
    return extractField(document, field);
  },
  shadow: ({ host, inner, action = "query", which, hosts } = {}) => {
    const allowed = hosts?.length ? hosts : BUILTIN_HOSTS;
    if (!hostMatches(location.hostname, allowed)) {
      return { found: false, open: false, classes: "", prefix: "" };
    }
    // Isolated-world content scripts can read an open shadowRoot. A closed root,
    // or a custom element that has not upgraded yet (`my-item`), looks unread.
    const hostEl = queryAll(document, host)[0];
    if (!hostEl) return { found: false, open: false, classes: "", prefix: "" };
    const root = hostEl.shadowRoot;
    if (!root) return { found: false, open: false, classes: "", prefix: "" };
    const target = inner ? root.querySelector(inner) : null;
    if (inner && !target) return { found: false, open: true, classes: "", prefix: "" };
    const node = target || root;
    if (action === "click") {
      clickSaveInDocument(host, inner, document, which);
    }
    const prefixNode = node.querySelector?.("[data-prefix]") || node;
    return {
      found: true,
      open: true,
      classes: String(node.className || ""),
      prefix: prefixNode.getAttribute?.("data-prefix") || "",
    };
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
