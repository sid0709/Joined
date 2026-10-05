/* global chrome */
import { createContext, useContext, useEffect, useState } from "react";

const ActiveTabContext = createContext(null);

/** Only web pages can run routines. */
export const isPageTab = (tab) => Number.isInteger(tab?.id) && /^https?:/i.test(tab.url || "");

const toPageTab = (tab) => ({
  id: tab.id,
  url: tab.url,
  title: typeof tab.title === "string" ? tab.title : "",
});

/**
 * Tracks the focused browser tab, so every panel knows which page it would act on.
 * The value is `{ id, url, title }`, or null when the focused tab is not a web page.
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
