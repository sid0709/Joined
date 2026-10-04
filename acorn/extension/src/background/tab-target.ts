/** Tab the caller pinned. Never the currently focused tab — Fill must stay on the tab that was active at click. */
export function pinnedTabId(
  requestedTabId: unknown,
  sender: chrome.runtime.MessageSender,
): number | null {
  if (typeof requestedTabId === "number" && Number.isFinite(requestedTabId)) {
    return requestedTabId;
  }
  return sender.tab?.id ?? null;
}

export async function resolvePreferredTabId(
  sender: chrome.runtime.MessageSender,
  requestedTabId: unknown,
): Promise<number | null> {
  const pinned = pinnedTabId(requestedTabId, sender);
  if (pinned != null) return pinned;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

export async function closeTabsQuietly(tabIds: number[]): Promise<void> {
  const ids = [...new Set(tabIds.filter((id) => Number.isFinite(id)))];
  if (ids.length === 0) return;
  try {
    await chrome.tabs.remove(ids);
  } catch {
    await Promise.all(ids.map((id) => chrome.tabs.remove(id).catch(() => undefined)));
  }
}
