/** Activate a Chrome tab and focus its window. */
export async function focusChromeTab(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.id == null) return false;
    await chrome.tabs.update(tab.id, { active: true });
    if (typeof tab.windowId === "number") {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}
