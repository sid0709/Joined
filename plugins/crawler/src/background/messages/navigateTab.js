/* global chrome */

/** How long a same-tab navigation may take before the page counts as hung. */
export const DEFAULT_NAVIGATE_TIMEOUT_MS = 15_000;

let navigateAbort = null;

export function abortInFlightNavigate() {
  navigateAbort?.abort();
  navigateAbort = null;
}

export function sameTabUrl(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    a.hash = "";
    b.hash = "";
    if (a.pathname.length > 1) a.pathname = a.pathname.replace(/\/$/, "");
    if (b.pathname.length > 1) b.pathname = b.pathname.replace(/\/$/, "");
    return a.href === b.href;
  } catch {
    return left === right;
  }
}

function waitForTabComplete(tabId, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Routine stopped"));
      return;
    }
    const finish = (fn) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Page op "navigate" timed out after ${timeoutMs} ms`)));
    }, timeoutMs);
    const onAbort = () => finish(() => reject(new Error("Routine stopped")));
    const onUpdated = (id, info, tab) => {
      if (id === tabId && info.status === "complete") finish(() => resolve(tab));
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Navigate the target tab in place and wait until it finishes loading. */
export async function navigateTab(tabId, url, timeoutMs = DEFAULT_NAVIGATE_TIMEOUT_MS) {
  const current = await chrome.tabs.get(tabId);
  if (current?.url && sameTabUrl(current.url, url)) {
    return { url: current.url };
  }
  abortInFlightNavigate();
  navigateAbort = new AbortController();
  const { signal } = navigateAbort;
  try {
    const pending = waitForTabComplete(tabId, timeoutMs, signal);
    const updated = await chrome.tabs.update(tabId, { url, active: true });
    const tab = (await pending) ?? updated;
    return { url: tab?.url || url };
  } finally {
    navigateAbort = null;
  }
}
