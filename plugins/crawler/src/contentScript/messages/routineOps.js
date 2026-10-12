import { extractField, queryAll, waitForMatches } from "../../routineKit/extract.js";
import { assertFetchUrl } from "../../routineKit/match.js";
import { clickLikeHuman } from "../actions/dom";
import { clearHighlights, highlightElements } from "../highlighter";

// The page side of the routine runner (routineKit/runner.js): each op does one thing to
// the live page and answers with its result.

const inFlightFetches = new Map();

const OPS = {
  count: ({ selector }) => ({ count: queryAll(document, selector).length }),
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
  shadow: ({ host, inner, action = "query" }) => {
    // Isolated-world content scripts can read an open shadowRoot. A closed root,
    // or a custom element that has not upgraded yet (`my-item`), looks unread.
    const hostEl = queryAll(document, host)[0];
    if (!hostEl) return { found: false, open: false, classes: "", prefix: "" };
    const root = hostEl.shadowRoot;
    if (!root) return { found: false, open: false, classes: "", prefix: "" };
    const target = inner ? root.querySelector(inner) : null;
    if (inner && !target) return { found: false, open: true, classes: "", prefix: "" };
    const node = target || root;
    if (action === "click") clickLikeHuman(target || hostEl);
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
