/* global chrome */

import { BOUND_TAB_CLOSED_MESSAGE, BOUND_TAB_MISSING_MESSAGE } from "../routineKit/protocol.js";

import { isInjectableTabUrl } from "./tabs.js";

export const BOUND_TAB_STORAGE_KEY = "crawlerBoundTabsV1";
export { BOUND_TAB_CLOSED_MESSAGE, BOUND_TAB_MISSING_MESSAGE };

const binds = new Map();

export class BoundTabError extends Error {
  constructor(message = BOUND_TAB_CLOSED_MESSAGE) {
    super(message);
    this.name = "BoundTabError";
    this.closed = message === BOUND_TAB_CLOSED_MESSAGE;
  }
}

export function resetBoundTabs() {
  binds.clear();
}

export function listBoundTabs() {
  return [...binds.values()];
}

export function getBoundTab(tabId) {
  return binds.get(Number(tabId)) || null;
}

export function saveBoundTab(bind) {
  const tabId = Number(bind?.tabId);
  if (!Number.isFinite(tabId)) throw new BoundTabError(BOUND_TAB_MISSING_MESSAGE);
  const next = {
    tabId,
    windowId: Number.isFinite(bind.windowId) ? bind.windowId : null,
    groupId: Number.isFinite(bind.groupId) ? bind.groupId : null,
    routineId: String(bind.routineId || ""),
  };
  binds.set(tabId, next);
  persistBoundTabs();
  return next;
}

export function removeBoundTab(tabId) {
  const removed = binds.delete(Number(tabId));
  if (removed) persistBoundTabs();
  return removed;
}

function persistBoundTabs() {
  const chromeApi = typeof chrome === "undefined" ? undefined : chrome;
  const chromeStorage = chromeApi?.storage?.session ?? chromeApi?.storage?.local;
  if (typeof chromeStorage?.set !== "function") return;
  void chromeStorage.set({ [BOUND_TAB_STORAGE_KEY]: listBoundTabs() }).catch(() => {});
}

/**
 * Drive only the bound tabId. Never query the active or focused tab.
 */
export async function resolveBoundTab(message, tabsApi = chrome.tabs) {
  const tabId = Number(message?.tabId ?? message?.payload?.tabId);
  if (!Number.isFinite(tabId)) throw new BoundTabError(BOUND_TAB_MISSING_MESSAGE);
  try {
    const tab = await tabsApi.get(tabId);
    if (tab?.id && isInjectableTabUrl(tab.url)) return tab;
  } catch {
    removeBoundTab(tabId);
    throw new BoundTabError(BOUND_TAB_CLOSED_MESSAGE);
  }
  removeBoundTab(tabId);
  throw new BoundTabError(BOUND_TAB_CLOSED_MESSAGE);
}

export { isBoundTabClosedError } from "../routineKit/protocol.js";
