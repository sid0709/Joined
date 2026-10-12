import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";
import { resolveTargetTab, sendToContentScript } from "../tabs.js";

import { abortInFlightNavigate, navigateTab } from "./navigateTab.js";

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
    const response = await sendToContentScript(tab.id, {
      action: ROUTINE_OP_ACTION,
      payload: message.payload,
    });
    sendResponse(response ?? { success: false, error: "The page did not answer the routine op" });
  })().catch((error) => sendResponse({ success: false, error: String(error?.message || error) }));
}
