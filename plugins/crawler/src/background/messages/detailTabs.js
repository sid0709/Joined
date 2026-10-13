/* global chrome */

import { hostMatches } from "../../routineKit/match.js";
import { BUILTIN_HOSTS } from "../../routines/builtin/constants.js";
import { HIRINGCAFE_HOSTS } from "../../routines/hiringcafe/constants.js";

/** Boards whose job pages a run may open in parallel background tabs. */
const DETAIL_TAB_HOSTS = Object.freeze([...HIRINGCAFE_HOSTS, ...BUILTIN_HOSTS]);
export const DEFAULT_DETAIL_TAB_CONCURRENCY = 30;
export const MAX_DETAIL_TAB_CONCURRENCY = 30;
export const DEFAULT_DETAIL_TAB_TIMEOUT_MS = 20_000;
export const DETAIL_TAB_POLL_MS = 300;
export const DETAIL_TAB_ABORTED = "Detail tabs stopped";

/** Open job tabs per bound crawl tab, so Stop or a closed crawl tab can close them. */
const openTabsByOwner = new Map();
const abortByOwner = new Map();

const defaultIo = {
  createTab: (props) => chrome.tabs.create(props),
  removeTab: (tabId) => chrome.tabs.remove(tabId),
  groupTabs: (options) => chrome.tabs.group(options),
  executeScript: (injection) => chrome.scripting.executeScript(injection),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

export function isDetailTabUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && hostMatches(parsed.hostname, DETAIL_TAB_HOSTS);
  } catch {
    return false;
  }
}

function track(ownerId, tabId) {
  if (!openTabsByOwner.has(ownerId)) openTabsByOwner.set(ownerId, new Set());
  openTabsByOwner.get(ownerId).add(tabId);
}

function untrack(ownerId, tabId) {
  openTabsByOwner.get(ownerId)?.delete(tabId);
}

async function closeTab(ownerId, tabId, io) {
  untrack(ownerId, tabId);
  await io.removeTab(tabId).catch(() => {});
}

/** Close every job tab this crawl tab opened, and stop the batch still loading. */
export async function closeDetailTabs(ownerId, io = defaultIo) {
  abortByOwner.get(ownerId)?.abort();
  const tabIds = [...(openTabsByOwner.get(ownerId) ?? [])];
  openTabsByOwner.delete(ownerId);
  await Promise.all(tabIds.map((tabId) => io.removeTab(tabId).catch(() => {})));
  return { closed: tabIds.length };
}

/**
 * Runs in the job tab: is it a challenge, is every ready selector present (and
 * parsing done), and its HTML once ready.
 */
export function readDetailPage(readySelectors, challengeTitleSource, challengeSelector) {
  const title = document.title || "";
  const titleChallenge = challengeTitleSource
    ? new RegExp(challengeTitleSource, "i").test(title)
    : false;
  const widgetChallenge = challengeSelector
    ? [...document.querySelectorAll(challengeSelector)].some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
    : false;
  const challenge = titleChallenge || widgetChallenge;
  const ready =
    !challenge &&
    document.readyState !== "loading" &&
    readySelectors.every((selector) => Boolean(document.querySelector(selector)));
  return {
    url: location.href,
    challenge,
    ready,
    html: ready ? document.documentElement.outerHTML : "",
  };
}

function readySelectorsOf(payload) {
  const list = Array.isArray(payload.readySelectors)
    ? payload.readySelectors
    : [payload.readySelector];
  return list.map((selector) => String(selector || "").trim()).filter(Boolean);
}

async function readTab(tabId, payload, io) {
  const [frame] = await io.executeScript({
    target: { tabId, frameIds: [0] },
    func: readDetailPage,
    args: [
      readySelectorsOf(payload),
      payload.challengeTitle || "",
      payload.challengeSelector || "",
    ],
  });
  return frame?.result ?? null;
}

/**
 * Open one job page in a background tab, wait until it is ready (or a
 * challenge, or the timeout), read its HTML, and always close the tab.
 */
async function loadDetailTab(url, owner, payload, signal, io) {
  if (!isDetailTabUrl(url)) return { url, error: "not a job board URL" };
  let tabId = null;
  try {
    const tab = await io.createTab({
      url,
      active: false,
      windowId: owner.windowId,
      ...(Number.isInteger(owner.index) ? { index: owner.index + 1 } : {}),
    });
    tabId = tab.id;
    track(owner.id, tabId);
    if (Number.isInteger(owner.groupId) && owner.groupId >= 0) {
      await io.groupTabs({ groupId: owner.groupId, tabIds: [tabId] }).catch(() => {});
    }
    const timeoutMs =
      Number(payload.timeoutMs) > 0 ? Number(payload.timeoutMs) : DEFAULT_DETAIL_TAB_TIMEOUT_MS;
    const deadline = io.now() + timeoutMs;
    while (io.now() < deadline) {
      if (signal.aborted) return { url, error: DETAIL_TAB_ABORTED };
      await io.sleep(DETAIL_TAB_POLL_MS);
      // The frame is not scriptable while it is still committing; try again.
      const page = await readTab(tabId, payload, io).catch(() => null);
      if (page?.challenge) return { url, challenge: true };
      if (page?.ready) return { url, finalUrl: page.url, html: page.html };
    }
    return { url, error: `timed out after ${timeoutMs} ms` };
  } catch (error) {
    return { url, error: String(error?.message || error) };
  } finally {
    if (tabId != null) await closeTab(owner.id, tabId, io);
  }
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

/**
 * Open `payload.urls` (job pages on a supported board) in background tabs
 * beside the bound crawl tab, `concurrency` at a time, and return each page's
 * HTML in order. A page behind a challenge comes back as `challenge: true`
 * so the run can open it in the crawl tab, where the user clears it.
 */
export async function openDetailTabs(owner, payload = {}, io = defaultIo) {
  const urls = Array.isArray(payload.urls) ? payload.urls.map((url) => String(url || "")) : [];
  if (!urls.length) return { pages: [] };
  const requested = Number(payload.concurrency) || DEFAULT_DETAIL_TAB_CONCURRENCY;
  const limit = Math.max(1, Math.min(MAX_DETAIL_TAB_CONCURRENCY, requested));
  abortByOwner.get(owner.id)?.abort();
  const controller = new AbortController();
  abortByOwner.set(owner.id, controller);
  try {
    const pages = await runPool(urls, limit, (url) =>
      loadDetailTab(url, owner, payload, controller.signal, io),
    );
    return { pages };
  } finally {
    if (abortByOwner.get(owner.id) === controller) abortByOwner.delete(owner.id);
  }
}
