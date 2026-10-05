import { getAccessToken, getAcornApiUrl } from "../../auth/acorn-auth";
import { runCustomGenerate } from "../../pipeline/custom-generate";
import { runCustomRecommend } from "../../pipeline/custom-recommend";
import { runJobGenerate } from "../../pipeline/job-generate";
import { runJobRecommend } from "../../pipeline/job-recommend";
import { getCustomTab } from "../../tab-custom-session";
import { MSG } from "../../types";
import { patchCustomGenerateFailed, patchJobGenerateFailed } from "../generate-failure";
import { pinnedTabId } from "../tab-target";
import {
  customGenerateTabIds,
  jobGenerateJobIds,
  pipelineRunningTabIds,
  syncWorkKeepAlive,
} from "../work-state";
import { SIGN_IN_FIRST, type RuntimeMessage, type SendResponse } from "./shared";

export function handleStartCustomGenerate(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    const tabId = pinnedTabId(message.tabId, sender);
    if (tabId == null) {
      sendResponse({ ok: false, error: "No tab for generate" });
      return;
    }
    const binding = await getCustomTab(tabId);
    if (!binding) {
      sendResponse({ ok: false, error: "Remember this tab first" });
      return;
    }
    if (customGenerateTabIds.has(tabId)) {
      sendResponse({ ok: false, error: "Already generating on this tab" });
      return;
    }
    if (pipelineRunningTabIds.has(tabId)) {
      sendResponse({ ok: false, error: "Fill is running on this tab" });
      return;
    }
    customGenerateTabIds.add(tabId);
    syncWorkKeepAlive();
    sendResponse({ ok: true });
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(SIGN_IN_FIRST);
      }
      const apiUrl = await getAcornApiUrl();
      await runCustomGenerate({
        tabId,
        apiUrl,
        continue: Boolean(message.continue),
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await patchCustomGenerateFailed(tabId, error);
    } finally {
      customGenerateTabIds.delete(tabId);
      syncWorkKeepAlive();
    }
  })();
}

export function handleStartCustomRecommend(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    const tabId = pinnedTabId(message.tabId, sender);
    if (tabId == null) {
      sendResponse({ ok: false, error: "No tab for recommend" });
      return;
    }
    const binding = await getCustomTab(tabId);
    if (!binding) {
      sendResponse({ ok: false, error: "Remember this tab first" });
      return;
    }
    if (customGenerateTabIds.has(tabId)) {
      sendResponse({ ok: false, error: "Already working on this tab" });
      return;
    }
    if (pipelineRunningTabIds.has(tabId)) {
      sendResponse({ ok: false, error: "Fill is running on this tab" });
      return;
    }
    customGenerateTabIds.add(tabId);
    syncWorkKeepAlive();
    sendResponse({ ok: true });
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(SIGN_IN_FIRST);
      }
      const apiUrl = await getAcornApiUrl();
      await runCustomRecommend({
        tabId,
        apiUrl,
        continue: Boolean(message.continue),
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await patchCustomGenerateFailed(tabId, error);
    } finally {
      customGenerateTabIds.delete(tabId);
      syncWorkKeepAlive();
    }
  })();
}

export function handleStartJobWork(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
): void {
  void (async () => {
    const jobId = String(message.jobId || "").trim();
    if (!jobId) {
      sendResponse({ ok: false, error: "Missing job id" });
      return;
    }
    if (jobGenerateJobIds.has(jobId)) {
      sendResponse({ ok: false, error: "Already generating for this job" });
      return;
    }
    const tabId = pinnedTabId(message.tabId, sender);
    jobGenerateJobIds.add(jobId);
    syncWorkKeepAlive();
    sendResponse({ ok: true });
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(SIGN_IN_FIRST);
      }
      const apiUrl = await getAcornApiUrl();
      const storedJd = typeof message.jobDescription === "string" ? message.jobDescription : null;
      const resume = Boolean(message.continue);
      if (message.type === MSG.START_JOB_RECOMMEND) {
        await runJobRecommend({
          jobId,
          tabId,
          apiUrl,
          continue: resume,
          storedJd,
        });
      } else {
        await runJobGenerate({
          jobId,
          tabId,
          apiUrl,
          continue: resume,
          storedJd,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await patchJobGenerateFailed(jobId, error);
    } finally {
      jobGenerateJobIds.delete(jobId);
      syncWorkKeepAlive();
    }
  })();
}
