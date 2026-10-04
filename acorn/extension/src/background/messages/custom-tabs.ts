import { focusChromeTab } from "../../focus-tab";
import { getCustomTab, rememberCustomTab, unbindCustomTab } from "../../tab-custom-session";
import { closeTabsQuietly, pinnedTabId } from "../tab-target";
import type { RuntimeMessage, SendResponse } from "./shared";

export function handleRememberCustomTab(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    try {
      const tabId = pinnedTabId(message.tabId, sender);
      if (tabId == null) {
        sendResponse({ ok: false, error: "No tab to remember" });
        return;
      }
      const tab = await chrome.tabs.get(tabId);
      const binding = await rememberCustomTab({
        tabId,
        url: String(tab.url || ""),
        title: String(tab.title || "Untitled"),
        favIconUrl: tab.favIconUrl || null,
        resumeMode: message.resumeMode === "recommend" ? "recommend" : "generate",
      });
      sendResponse({ ok: true, tab: binding });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

export function handleForgetCustomTab(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    try {
      const tabId = pinnedTabId(message.tabId, sender);
      if (tabId == null) {
        sendResponse({ ok: false, error: "No tab to forget" });
        return;
      }
      await unbindCustomTab(tabId);
      await closeTabsQuietly([tabId]);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

export function handleFocusCustomTab(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    const tabId = pinnedTabId(message.tabId, sender);
    if (tabId == null) {
      sendResponse({ ok: false, error: "No tab to show" });
      return;
    }
    const binding = await getCustomTab(tabId);
    if (!binding) {
      sendResponse({ ok: false, error: "That tab is not remembered" });
      return;
    }
    const focused = await focusChromeTab(tabId);
    sendResponse(focused ? { ok: true } : { ok: false, error: "That tab is no longer open." });
  })();
}
