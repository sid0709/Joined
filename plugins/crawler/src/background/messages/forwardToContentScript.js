import { safeSendMessage } from "../runtime.js";
import { resolveTargetTab, sendToContentScript } from "../tabs.js";

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
    // These actions answer through runtime broadcasts, not a response, so Chrome reports
    // the closed response port as an error. Nothing here waits on a reply.
    await sendToContentScript(targetTab.id, message).catch(() => {});
  })();
}
