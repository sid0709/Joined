import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";
import { resolveTargetTab, sendToContentScript } from "../tabs.js";

import { abortInFlightNavigate, navigateTab } from "./navigateTab.js";
import { clickShadowInMainWorld } from "./shadowClick.js";

// Side panel → background: run one routine op in the target tab and relay its response.
export function handleRoutineExec(message, sendResponse) {
  (async () => {
    const tab = await resolveTargetTab(message);
    if (!tab?.id) {
      sendResponse({ success: false, error: "No page tab found. Focus the site and try again." });
      return;
    }
    const op = message.payload?.op;
    if (op === "abortFetches") {
      abortInFlightNavigate();
    }
    if (op === "navigate") {
      const result = await navigateTab(tab.id, message.payload.url, message.payload.timeout);
      sendResponse({ success: true, result });
      return;
    }
    if (op === "shadow" && message.payload?.action === "click") {
      try {
        const result = await clickShadowInMainWorld(tab.id, message.payload);
        sendResponse({ success: true, result });
        return;
      } catch (error) {
        console.warn("MAIN-world heart click failed; falling back to the isolated world", error);
      }
    }
    const response = await sendToContentScript(tab.id, {
      action: ROUTINE_OP_ACTION,
      payload: message.payload,
    });
    sendResponse(response ?? { success: false, error: "The page did not answer the routine op" });
  })().catch((error) => sendResponse({ success: false, error: String(error?.message || error) }));
}
