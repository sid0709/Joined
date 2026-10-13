/* global chrome */
import { createContext, useContext, useEffect, useState } from "react";

const ActiveTabContext = createContext(null);

/** Only web pages can run routines. */
export const isPageTab = (tab) => Number.isInteger(tab?.id) && /^https?:/i.test(tab.url || "");

export const toPageTab = (tab) => ({
  id: tab.id,
  url: tab.url,
  title: typeof tab.title === "string" ? tab.title : "",
  windowId: Number.isFinite(tab.windowId) ? tab.windowId : undefined,
});

/**
 * Popup-only: which page the Start button would bind. Routine runs never read
 * this after bind — they drive the stored tabId. The active-tab query below
 * is not on the crawl path.
 */
export function ActiveTabProvider({ children }) {
  const [tab, setTab] = useState(null);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return undefined;
    let cancelled = false;

    const refresh = async () => {
      try {
        const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        // No active tab means DevTools or another non-browser window has focus: keep the last page.
        if (cancelled || !active) return;
        setTab(isPageTab(active) ? toPageTab(active) : null);
      } catch {
        if (!cancelled) setTab(null);
      }
    };
    const onUpdated = (_tabId, change) => {
      if (change.url || change.title || change.status === "complete") void refresh();
    };
    const onActivated = () => void refresh();
    const onFocusChanged = () => void refresh();

    void refresh();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows?.onFocusChanged?.addListener(onFocusChanged);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows?.onFocusChanged?.removeListener(onFocusChanged);
    };
  }, []);

  return <ActiveTabContext.Provider value={tab}>{children}</ActiveTabContext.Provider>;
}

export const useActiveTab = () => useContext(ActiveTabContext);
