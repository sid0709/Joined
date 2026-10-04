import type { Socket } from "socket.io-client";
import { sendPlanStepToTab } from "../tab-messaging";
import {
  MSG,
  type ExecuteActionsPayload,
  type GetContentPayload,
  type HighlightPayload,
  type PlanStepSocketPayload,
} from "../types";

export function bindSocketRelay(socket: Socket): void {
  socket.on("dom:highlight", async (payload: HighlightPayload) => {
    const { tabId, nodeId } = payload;
    if (!tabId || nodeId == null) return;
    try {
      await chrome.tabs.sendMessage(tabId, { type: MSG.HIGHLIGHT, nodeId });
    } catch {
      /* tab has no content script */
    }
  });

  socket.on("dom:get-content", (payload: GetContentPayload, ack?: (res: unknown) => void) => {
    const { tabId, nodeId, contentType } = payload;
    if (!tabId || nodeId == null || !contentType) {
      ack?.({ error: "Invalid payload" });
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: MSG.GET_CONTENT, nodeId, contentType }, (res) => {
      if (chrome.runtime.lastError) {
        ack?.({ error: chrome.runtime.lastError.message });
        return;
      }
      ack?.(res);
    });
  });

  socket.on(
    "dom:execute-actions",
    (payload: ExecuteActionsPayload, ack?: (res: unknown) => void) => {
      const { tabId, nodeId, steps } = payload;
      if (!tabId || nodeId == null || !steps?.length) {
        ack?.({ error: "Invalid payload" });
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: MSG.EXECUTE_ACTIONS, nodeId, steps }, (res) => {
        if (chrome.runtime.lastError) {
          ack?.({ error: chrome.runtime.lastError.message });
          return;
        }
        ack?.(res);
      });
    },
  );

  socket.on("dom:plan-step", (payload: PlanStepSocketPayload, ack?: (res: unknown) => void) => {
    const { tabId, step, frameId } = payload ?? {};
    if (!tabId || !step?.action) {
      ack?.({ ok: false, error: "Missing tabId or step" });
      return;
    }
    void sendPlanStepToTab(tabId, step, frameId)
      .then((res) => ack?.(res))
      .catch((err) =>
        ack?.({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });
}
