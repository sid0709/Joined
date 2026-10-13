/* global chrome */

import { NAVIGATE_UNTIL_DOM_READY } from "../../routineKit/protocol.js";

/** How long a same-tab navigation may take before the page counts as hung. */
export const DEFAULT_NAVIGATE_TIMEOUT_MS = 15_000;

const navigateAborts = new Map();

export function abortInFlightNavigate(tabId) {
  if (tabId == null) {
    for (const controller of navigateAborts.values()) controller.abort();
    navigateAborts.clear();
    return;
  }
  navigateAborts.get(tabId)?.abort();
  navigateAborts.delete(tabId);
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

function waitForTabLoad(tabId, timeoutMs, signal, until) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Routine stopped"));
      return;
    }
    const domEvents = until === NAVIGATE_UNTIL_DOM_READY ? chrome.webNavigation : null;
    const finish = (fn) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      domEvents?.onDOMContentLoaded.removeListener(onDomReady);
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
    // The top frame's HTML is parsed; images, ads, and trackers may still be loading.
    const onDomReady = (details) => {
      if (details.tabId === tabId && details.frameId === 0) {
        finish(() => resolve({ url: details.url }));
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    domEvents?.onDOMContentLoaded.addListener(onDomReady);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Navigate the target tab in place and wait until it finishes loading. With
 * `until: NAVIGATE_UNTIL_DOM_READY`, resolve at the top frame's DOMContentLoaded
 * (or `complete`, whichever is first); the routine waits for the nodes it needs.
 */
export async function navigateTab(tabId, url, timeoutMs = DEFAULT_NAVIGATE_TIMEOUT_MS, until) {
  const current = await chrome.tabs.get(tabId);
  if (current?.url && sameTabUrl(current.url, url)) {
    return { url: current.url };
  }
  abortInFlightNavigate(tabId);
  const controller = new AbortController();
  navigateAborts.set(tabId, controller);
  const { signal } = controller;
  try {
    const pending = waitForTabLoad(tabId, timeoutMs, signal, until);
    const updated = await chrome.tabs.update(tabId, { url });
    const tab = (await pending) ?? updated;
    return { url: tab?.url || url };
  } finally {
    if (navigateAborts.get(tabId) === controller) navigateAborts.delete(tabId);
  }
}
