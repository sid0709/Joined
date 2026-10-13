/* global chrome */

import {
  BOUND_TAB_MISSING_MESSAGE,
  getBoundTab,
  listBoundTabs,
  removeBoundTab,
  saveBoundTab,
} from "../boundTab.js";
import { startRunKeepalive, stopRunKeepaliveIfIdle } from "../runKeepalive.js";
import { groupBoundTab, ungroupBoundTab } from "../tabGroup.js";

import { releaseDebugger } from "./debuggerMouse.js";

const defaultIo = {
  tabs: {
    get: (tabId) => chrome.tabs.get(tabId),
  },
  groupBoundTab,
  ungroupBoundTab,
  startKeepalive: startRunKeepalive,
  stopKeepalive: stopRunKeepaliveIfIdle,
  releaseDebugger,
  alarms: () => globalThis.chrome?.alarms,
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

function alarmsOf(io) {
  if (typeof io.alarms === "function") return io.alarms();
  return io.alarms ?? globalThis.chrome?.alarms;
}

export async function unbindCrawlTab(tabId, io = defaultIo) {
  const removed = removeBoundTab(tabId);
  const id = Number(tabId);
  await io.releaseDebugger?.(id);
  await io.ungroupBoundTab?.(id);
  io.stopKeepalive?.(alarmsOf(io), listBoundTabs().length);
  return { removed, tabId: id };
}

export function handleBindTab(message, sendResponse, io = defaultIo) {
  bindCrawlTab({ tabId: message.tabId, ...message.payload }, io)
    .then((result) => sendResponse({ success: true, result }))
    .catch((error) => sendResponse({ success: false, error: String(error?.message || error) }));
}

export function handleUnbindTab(message, sendResponse, io = defaultIo) {
  const tabId = message.tabId ?? message.payload?.tabId;
  Promise.resolve(unbindCrawlTab(tabId, io))
    .then((result) => sendResponse({ success: true, result }))
    .catch((error) => sendResponse({ success: false, error: String(error?.message || error) }));
}

export async function handleBoundTabRemoved(tabId, io = {}) {
  const bind = getBoundTab(tabId);
  if (!bind) return null;
  const next = { ...defaultIo, ...io };
  next.abortInFlightNavigate?.(tabId);
  await unbindCrawlTab(tabId, next);
  return bind;
}
