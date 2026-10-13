/* global chrome */

import {
  BOUND_TAB_MISSING_MESSAGE,
  getBoundTab,
  listBoundTabs,
  removeBoundTab,
  saveBoundTab,
} from "../boundTab.js";
import { startRunKeepalive, stopRunKeepaliveIfIdle } from "../runKeepalive.js";
import { groupBoundTab } from "../tabGroup.js";

const defaultIo = {
  tabs: {
    get: (tabId) => chrome.tabs.get(tabId),
  },
  groupBoundTab,
  startKeepalive: startRunKeepalive,
  stopKeepalive: stopRunKeepaliveIfIdle,
};

export async function bindCrawlTab(payload = {}, io = defaultIo) {
  const tabId = Number(payload.tabId);
  if (!Number.isFinite(tabId)) throw new Error(BOUND_TAB_MISSING_MESSAGE);
  const tab = await io.tabs.get(tabId);
  const windowId = Number.isFinite(payload.windowId) ? payload.windowId : tab?.windowId;
  const routineId = String(payload.routineId || "");
  const groupId = await io.groupBoundTab({ ...tab, id: tabId, windowId }, routineId);
  const bind = saveBoundTab({ tabId, windowId, groupId, routineId });
  io.startKeepalive?.();
  return bind;
}

export function unbindCrawlTab(tabId, io = defaultIo) {
  const removed = removeBoundTab(tabId);
  io.stopKeepalive?.(listBoundTabs().length);
  return { removed, tabId: Number(tabId) };
}

export function handleBindTab(message, sendResponse, io = defaultIo) {
  bindCrawlTab({ tabId: message.tabId, ...message.payload }, io)
    .then((result) => sendResponse({ success: true, result }))
    .catch((error) => sendResponse({ success: false, error: String(error?.message || error) }));
}

export function handleUnbindTab(message, sendResponse, io = defaultIo) {
  try {
    const tabId = message.tabId ?? message.payload?.tabId;
    sendResponse({ success: true, result: unbindCrawlTab(tabId, io) });
  } catch (error) {
    sendResponse({ success: false, error: String(error?.message || error) });
  }
}

export function handleBoundTabRemoved(tabId, io = {}) {
  const bind = getBoundTab(tabId);
  if (!bind) return null;
  unbindCrawlTab(tabId, io);
  io.releaseDebugger?.(tabId);
  io.abortInFlightNavigate?.(tabId);
  return bind;
}
