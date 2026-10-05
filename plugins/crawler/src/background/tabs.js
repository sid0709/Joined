/* global chrome */

export function isInjectableTabUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /^(https?:|file:)/i.test(url);
}

/**
 * Side panel clicks often leave currentWindow ambiguous (or focused on DevTools).
 * Prefer an explicit tabId, then last-focused window, then any normal window's active tab.
 */
export async function resolveTargetTab(message) {
  const explicitTabId = message?.tabId ?? message?.payload?.tabId;
  if (Number.isFinite(explicitTabId)) {
    try {
      const tab = await chrome.tabs.get(explicitTabId);
      if (tab?.id && isInjectableTabUrl(tab.url)) return tab;
    } catch (e) {
      console.warn("Failed to resolve explicit tabId", explicitTabId, e);
    }
  }

  const queryFirstInjectable = async (queryInfo) => {
    try {
      const tabs = await chrome.tabs.query(queryInfo);
      return tabs.find((tab) => tab?.id && isInjectableTabUrl(tab.url)) || null;
    } catch (e) {
      console.warn("tabs.query failed", queryInfo, e);
      return null;
    }
  };

  const fromLastFocused = await queryFirstInjectable({ active: true, lastFocusedWindow: true });
  if (fromLastFocused) return fromLastFocused;

  const fromCurrent = await queryFirstInjectable({ active: true, currentWindow: true });
  if (fromCurrent) return fromCurrent;

  try {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    const ordered = [
      ...windows.filter((win) => win.focused),
      ...windows.filter((win) => !win.focused),
    ];
    for (const win of ordered) {
      const active = win.tabs?.find((tab) => tab.active && isInjectableTabUrl(tab.url));
      if (active) return active;
    }
  } catch (e) {
    console.warn("windows.getAll fallback failed", e);
  }

  return null;
}

export async function ensureContentScriptInjected(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => {
        const ATTR = "data-autolancer-content-script-injected";
        const root = document.documentElement || document.head || document.body;
        if (!root) return false;
        // Only *check* if injected. Do not set any flags here because the content script
        // uses the same guards and would skip initialization if we pre-set them.
        return !(root.hasAttribute(ATTR) || window.contentScriptInjected);
      },
    });

    if (result) {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: ["contentScript.js"],
      });
    }
    return true;
  } catch (e) {
    console.error("Failed to ensure content script injection", e);
    return false;
  }
}
