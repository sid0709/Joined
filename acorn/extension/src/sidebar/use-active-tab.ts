import { useEffect, useState } from "react";

/** Active tab in the window that hosts this side panel. */
export function useActiveTabId(): number | null {
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    let windowId: number | undefined;
    let cancelled = false;

    const readActive = async () => {
      const query: chrome.tabs.QueryInfo =
        windowId != null ? { active: true, windowId } : { active: true, currentWindow: true };
      const [tab] = await chrome.tabs.query(query);
      if (!cancelled) setTabId(tab?.id ?? null);
    };

    void (async () => {
      const win = await chrome.windows.getCurrent();
      if (cancelled) return;
      windowId = win.id;
      await readActive();
    })();

    const onActivated = (info: chrome.tabs.TabActiveInfo) => {
      if (windowId != null && info.windowId !== windowId) return;
      setTabId(info.tabId);
    };

    const onRemoved = () => {
      void readActive();
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };
  }, []);

  return tabId;
}
