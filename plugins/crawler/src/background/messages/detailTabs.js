/* global chrome */

import { hostMatches } from "../../routineKit/match.js";
import { BUILTIN_HOSTS } from "../../routines/builtin/constants.js";
import { HIRINGCAFE_HOSTS } from "../../routines/hiringcafe/constants.js";

/** Boards whose job pages a run may open in background tabs. */
const DETAIL_TAB_HOSTS = Object.freeze([...HIRINGCAFE_HOSTS, ...BUILTIN_HOSTS]);
export const MAX_DETAIL_TABS = 30;
export const DETAIL_TAB_OPS = Object.freeze([
  "openDetailTabs",
  "readDetailTabs",
  "reloadDetailTabs",
  "closeDetailTabs",
]);

/** Open job tabs per bound crawl tab, so Stop or a closed crawl tab can close them. */
const openTabsByOwner = new Map();

const defaultIo = {
  createTab: (props) => chrome.tabs.create(props),
  removeTab: (tabId) => chrome.tabs.remove(tabId),
  reloadTab: (tabId) => chrome.tabs.reload(tabId),
  groupTabs: (options) => chrome.tabs.group(options),
  executeScript: (injection) => chrome.scripting.executeScript(injection),
};

export function isDetailTabUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && hostMatches(parsed.hostname, DETAIL_TAB_HOSTS);
  } catch {
    return false;
  }
}

function ownedTabs(ownerId) {
  if (!openTabsByOwner.has(ownerId)) openTabsByOwner.set(ownerId, new Set());
  return openTabsByOwner.get(ownerId);
}

/** Only tabs this crawl tab opened; a run can never read or close another tab. */
function ownedIds(ownerId, tabIds) {
  const owned = openTabsByOwner.get(ownerId);
  return (Array.isArray(tabIds) ? tabIds : []).filter((tabId) => owned?.has(tabId));
}

/** Runs in the job tab: its URL, and its HTML once the document has parsed. */
export function readDetailPage() {
  const loading = document.readyState === "loading";
  return {
    url: location.href,
    loading,
    html: loading ? "" : document.documentElement.outerHTML,
  };
}

/** Open each job URL (supported boards only) as a background tab beside the crawl tab. */
export async function openDetailTabs(owner, payload = {}, io = defaultIo) {
  const urls = (Array.isArray(payload.urls) ? payload.urls : []).slice(0, MAX_DETAIL_TABS);
  const tabs = await Promise.all(
    urls.map(async (raw) => {
      const url = String(raw || "");
      if (!isDetailTabUrl(url)) return { url, error: "not a job board URL" };
      try {
        const tab = await io.createTab({
          url,
          active: false,
          windowId: owner.windowId,
          ...(Number.isInteger(owner.index) ? { index: owner.index + 1 } : {}),
        });
        ownedTabs(owner.id).add(tab.id);
        if (Number.isInteger(owner.groupId) && owner.groupId >= 0) {
          await io.groupTabs({ groupId: owner.groupId, tabIds: [tab.id] }).catch(() => {});
        }
        return { url, tabId: tab.id };
      } catch (error) {
        return { url, error: String(error?.message || error) };
      }
    }),
  );
  return { tabs };
}

/** Each owned tab's URL and parsed HTML. A tab between documents reports `loading`. */
export async function readDetailTabs(owner, payload = {}, io = defaultIo) {
  const pages = await Promise.all(
    ownedIds(owner.id, payload.tabIds).map(async (tabId) => {
      try {
        const [frame] = await io.executeScript({
          target: { tabId, frameIds: [0] },
          func: readDetailPage,
        });
        return { tabId, ...(frame?.result ?? { loading: true, html: "" }) };
      } catch {
        // The frame is not scriptable while it is still committing; read it next poll.
        return { tabId, loading: true, html: "" };
      }
    }),
  );
  return { pages };
}

export async function reloadDetailTabs(owner, payload = {}, io = defaultIo) {
  const tabIds = ownedIds(owner.id, payload.tabIds);
  await Promise.all(tabIds.map((tabId) => io.reloadTab(tabId).catch(() => {})));
  return { reloaded: tabIds.length };
}

/**
 * Close the named job tabs, or every job tab this crawl tab opened when no
 * `tabIds` are given (Stop, or the crawl tab is gone).
 */
export async function closeDetailTabs(ownerId, payload = {}, io = defaultIo) {
  const owned = openTabsByOwner.get(ownerId);
  const tabIds = Array.isArray(payload?.tabIds)
    ? ownedIds(ownerId, payload.tabIds)
    : [...(owned ?? [])];
  for (const tabId of tabIds) owned?.delete(tabId);
  if (owned && !owned.size) openTabsByOwner.delete(ownerId);
  await Promise.all(tabIds.map((tabId) => io.removeTab(tabId).catch(() => {})));
  return { closed: tabIds.length };
}

/** Route one detail-tab op for the bound crawl tab `owner`. */
export function runDetailTabOp(op, owner, payload, io = defaultIo) {
  if (op === "openDetailTabs") return openDetailTabs(owner, payload, io);
  if (op === "readDetailTabs") return readDetailTabs(owner, payload, io);
  if (op === "reloadDetailTabs") return reloadDetailTabs(owner, payload, io);
  return closeDetailTabs(owner.id, payload, io);
}
