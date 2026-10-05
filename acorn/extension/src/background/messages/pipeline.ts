import { getAcornSocket } from "../../acorn-socket";
import { getAccessToken, getAcornApiUrl } from "../../auth/acorn-auth";
import { runFabPipeline } from "../../pipeline/run-pipeline";
import { getCustomTab } from "../../tab-custom-session";
import { MSG, type DomTreePayload } from "../../types";
import { broadcastPipelineProgress } from "../socket-connection";
import { pinnedTabId } from "../tab-target";
import { customGenerateTabIds, pipelineRunningTabIds, syncWorkKeepAlive } from "../work-state";
import { SIGN_IN_FIRST, type RuntimeMessage, type SendResponse } from "./shared";

export function handleStartPipeline(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    const tabId = pinnedTabId(message.tabId, sender);
    if (!tabId) {
      sendResponse({ error: "No tab for pipeline" });
      return;
    }
    if (pipelineRunningTabIds.has(tabId)) {
      sendResponse({ error: "A pipeline is already running on this tab" });
      return;
    }
    if (customGenerateTabIds.has(tabId)) {
      sendResponse({ error: "Generate or Recommend is running on this tab" });
      return;
    }

    const source = message.source === "custom" ? "custom" : "fill";
    if (source === "custom") {
      const customTab = await getCustomTab(tabId);
      if (!customTab) {
        sendResponse({ error: "Remember this tab first" });
        return;
      }
    }

    pipelineRunningTabIds.add(tabId);
    syncWorkKeepAlive();
    sendResponse({ ok: true });

    try {
      const token = await getAccessToken();
      if (!token) {
        broadcastPipelineProgress(tabId, {
          phase: "error",
          message: "Sign in required",
          error: SIGN_IN_FIRST,
        });
        return;
      }

      const apiUrl = await getAcornApiUrl();
      await runFabPipeline({
        tabId,
        source,
        preferredFrameId: sender.tab ? (sender.frameId ?? null) : null,
        aiServerUrl: apiUrl,
        emitDomTree: (payload) => {
          getAcornSocket()?.emit("dom:tree", payload);
        },
        onProgress: (progress) => {
          broadcastPipelineProgress(tabId, progress);
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      broadcastPipelineProgress(tabId, {
        phase: "error",
        message: "Failed",
        error,
      });
    } finally {
      pipelineRunningTabIds.delete(tabId);
      syncWorkKeepAlive();
    }
  })();
}

export function handleFetchDom(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    const tabId = pinnedTabId(message.tabId, sender);
    if (!tabId) {
      sendResponse({ error: "No tab for DOM fetch" });
      return;
    }
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: MSG.FETCH_DOM });

      if (result?.error) {
        sendResponse({ error: result.error });
        return;
      }

      if (!result?.tree) {
        sendResponse({ error: "No DOM tree returned from page" });
        return;
      }

      const payload: DomTreePayload = { ...result, tabId };

      if (message.type === MSG.FETCH_AND_EMIT_DOM) {
        getAcornSocket()?.emit("dom:tree", payload);
      }

      sendResponse(payload);
    } catch (err) {
      sendResponse({ error: String(err) });
    }
  })();
}
