/* global chrome */

const WATCH_KEY = "__joinedScrapperFetchWatch";

/**
 * Wrap page `fetch` in the MAIN world so HiringCafe's stage POST is visible.
 * Injectable as a MAIN-world `func` — do not close over imports.
 */
export function installFetchWatchInDocument(urlIncludes) {
  const existing = globalThis[WATCH_KEY];
  if (existing?.restore) existing.restore();
  const hits = [];
  const original = globalThis.fetch;
  if (typeof original !== "function") return { watching: false, hits };
  globalThis.fetch = async function watchedFetch(...args) {
    const result = await original.apply(this, args);
    const request = args[0];
    const url = String(request?.url || request || "");
    if (!urlIncludes || url.includes(urlIncludes)) {
      let body = "";
      let requestBody = "";
      try {
        body = await result.clone().text();
      } catch {
        body = "";
      }
      const init = args[1];
      if (typeof init?.body === "string") requestBody = init.body;
      hits.push({ url, status: result.status, body, request: requestBody });
    }
    return result;
  };
  globalThis[WATCH_KEY] = {
    hits,
    restore() {
      globalThis.fetch = original;
      delete globalThis[WATCH_KEY];
    },
  };
  return { watching: true, hits };
}

export function readFetchWatchInDocument() {
  return { hits: globalThis[WATCH_KEY]?.hits ?? [] };
}

export function clearFetchWatchInDocument() {
  globalThis[WATCH_KEY]?.restore?.();
  return { watching: false, hits: [] };
}

export async function installFetchWatchInMainWorld(tabId, { urlIncludes } = {}) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: "MAIN",
    func: installFetchWatchInDocument,
    args: [urlIncludes || ""],
  });
  return result ?? { watching: false, hits: [] };
}

export async function readFetchWatchInMainWorld(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: "MAIN",
    func: readFetchWatchInDocument,
    args: [],
  });
  return result ?? { hits: [] };
}

export async function clearFetchWatchInMainWorld(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: "MAIN",
    func: clearFetchWatchInDocument,
    args: [],
  });
  return result ?? { watching: false, hits: [] };
}
