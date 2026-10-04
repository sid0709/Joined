/* global chrome */
import { safeSendMessage } from "../runtime.js";
import { ensureContentScriptInjected, resolveTargetTab } from "../tabs.js";

// Actions that need to be sent to the content script
export const actionsToForward = [
  "highlightByPattern",
  "highlightBySelectors",
  "highlightInteractables",
  "executePlan",
  "collectDomHints",
  "clearHighlight",
  "executeAction",
  "executeActionsSequence",
  "executeActionsParallel",
];

export function forwardToContentScript(message) {
  (async () => {
    const targetTab = await resolveTargetTab(message);
    if (!targetTab?.id) {
      console.warn("No target tab found for action", message.action);
      if (message.action === "highlightByPattern" || message.action === "clearHighlight") {
        safeSendMessage({
          action: "highlightResult",
          payload: {
            success: false,
            count: 0,
            error: "No active page tab found. Focus the job page and try again.",
          },
        });
      }
      return;
    }
    const targetTabId = targetTab.id;
    chrome.tabs.sendMessage(targetTabId, message, { frameId: 0 }, () => {
      if (!chrome.runtime.lastError) return;
      const lastErrorMessage = chrome.runtime.lastError?.message || "";
      // Only attempt the guarded injection if the receiver is missing (navigation/new page).
      if (!/Receiving end does not exist|Could not establish connection/i.test(lastErrorMessage))
        return;

      ensureContentScriptInjected(targetTabId)
        .then(() => {
          try {
            chrome.tabs.sendMessage(targetTabId, message, { frameId: 0 }, () => {
              // Read lastError so Chrome does not surface a noisy unchecked runtime warning.
              void chrome.runtime.lastError;
            });
          } catch (e) {
            console.error("Failed to send message after ensuring contentScript", e);
          }
        })
        .catch((err) => {
          console.error("Failed to ensure contentScript before resend", err);
        });
    });
  })();
}
