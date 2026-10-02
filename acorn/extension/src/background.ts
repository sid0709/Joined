import type { Socket } from "socket.io-client";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import {
  authHeaders,
  getAccessToken,
  getAthensApiUrl,
  getAcornSession,
  isJoinedSessionCookie,
  acornSignIn,
  acornSignOut,
  syncJoinedSession,
} from "./auth/acorn-auth";
import {
  connectAcornSocket,
  getAcornSocket,
  isAcornSocketConnected,
  scheduleConnectAcornSocket,
  type AcornSocketHandlers,
} from "./acorn-socket";
import { matchOptionViaAnalyze } from "./pipeline/match-option-analyze";
import { runFabPipeline } from "./pipeline/run-pipeline";
import { runCustomGenerate } from "./pipeline/custom-generate";
import { runCustomRecommend } from "./pipeline/custom-recommend";
import { runJobGenerate } from "./pipeline/job-generate";
import { runJobRecommend } from "./pipeline/job-recommend";
import { requestQaAnswer } from "./pipeline/ai-client";
import { addPipelineUsage, rekeyPipelineUsage } from "./pipeline/usage-tracker";
import { focusChromeTab } from "./focus-tab";
import { bindContentScriptInjection, injectIntoOpenTabs } from "./inject-content";
import { openWorkerJobInTab } from "./open-worker-job";
import { sendPlanStepToTab } from "./tab-messaging";
import {
  findTabIdsForJob,
  getTabJob,
  rekeyTabJob,
  unbindJobFromAllTabs,
  unbindTabJob,
} from "./tab-job-session";
import {
  getCustomTab,
  patchCustomTab,
  rekeyCustomTab,
  rememberCustomTab,
  refreshCustomTabMeta,
  unbindCustomTab,
} from "./tab-custom-session";
import { getJobGenerate, patchJobGenerate } from "./tab-job-generate-session";
import { clearTabPipeline, queueTabPipeline, rekeyTabPipeline } from "./tab-pipeline-session";
import { broadcastOperatorNotice, socketErrorDetail } from "./operator-notice";
import { mapAcornWorkerJobs } from "./worker-job";
import {
  MSG,
  ACORN_SIDEBAR_PORT,
  type DomTreePayload,
  type ExecuteActionsPayload,
  type GetContentPayload,
  type HighlightPayload,
  type MatchOptionRequest,
  type MatchOptionResponse,
  type PlanStepSocketPayload,
} from "./types";

let socketErrorToastAt = 0;
const SOCKET_TOAST_MS = 12_000;
const sidebarPorts = new Set<chrome.runtime.Port>();
/** Tabs with an in-flight FAB pipeline (parallel across tabs; one per tab). */
const pipelineRunningTabIds = new Set<number>();
const customGenerateTabIds = new Set<number>();
const jobGenerateJobIds = new Set<string>();

async function patchCustomGenerateFailed(tabId: number, error: string): Promise<void> {
  const tab = await getCustomTab(tabId);
  if (tab?.generateStatus === "failed" && tab.checkpoint) {
    if (!tab.generateError) {
      await patchCustomTab(tabId, { generateError: error });
    }
    return;
  }
  await patchCustomTab(tabId, {
    generateStatus: "failed",
    generateError: error,
  });
}

async function patchJobGenerateFailed(jobId: string, error: string): Promise<void> {
  const row = await getJobGenerate(jobId);
  if (row?.generateStatus === "failed" && row.checkpoint) {
    if (!row.generateError) {
      await patchJobGenerate(jobId, { generateError: error });
    }
    return;
  }
  await patchJobGenerate(jobId, {
    generateStatus: "failed",
    generateError: error,
  });
}

function enableSidePanelOnActionClick(): void {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
}

/** Tab the caller pinned. Never the currently focused tab — Fill must stay on the tab that was active at click. */
function pinnedTabId(requestedTabId: unknown, sender: chrome.runtime.MessageSender): number | null {
  if (typeof requestedTabId === "number" && Number.isFinite(requestedTabId)) {
    return requestedTabId;
  }
  return sender.tab?.id ?? null;
}

async function resolvePreferredTabId(
  sender: chrome.runtime.MessageSender,
  requestedTabId: unknown,
): Promise<number | null> {
  const pinned = pinnedTabId(requestedTabId, sender);
  if (pinned != null) return pinned;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

function broadcastPipelineProgress(tabId: number, progress: PipelineProgress): void {
  getAcornSocket()?.emit("pipeline:progress", { tabId, progress });
  void queueTabPipeline(tabId, progress);
  chrome.runtime.sendMessage({ type: MSG.PIPELINE_PROGRESS, tabId, progress }, () => {
    void chrome.runtime.lastError;
  });
}

const KEEP_ALIVE_ALARM = "acorn-socket-keep-alive";
const WORK_KEEP_ALIVE_ALARM = "acorn-work-keep-alive";
chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });

function anyTabWorking(): boolean {
  return (
    pipelineRunningTabIds.size > 0 || customGenerateTabIds.size > 0 || jobGenerateJobIds.size > 0
  );
}

async function closeTabsQuietly(tabIds: number[]): Promise<void> {
  const ids = [...new Set(tabIds.filter((id) => Number.isFinite(id)))];
  if (ids.length === 0) return;
  try {
    await chrome.tabs.remove(ids);
  } catch {
    await Promise.all(ids.map((id) => chrome.tabs.remove(id).catch(() => undefined)));
  }
}

function syncWorkKeepAlive(): void {
  if (anyTabWorking()) {
    chrome.alarms.create(WORK_KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });
    return;
  }
  void chrome.alarms.clear(WORK_KEEP_ALIVE_ALARM);
}

function pushSocketStatus(connected: boolean): void {
  const message = { type: MSG.SOCKET_STATUS, connected };
  for (const port of sidebarPorts) {
    try {
      port.postMessage(message);
    } catch {
      sidebarPorts.delete(port);
    }
  }
}

function bindSocketRelay(socket: Socket): void {
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

const socketHandlers: AcornSocketHandlers = {
  bindEvents: bindSocketRelay,
  onConnected: () => {
    const recovered = socketErrorToastAt > 0;
    pushSocketStatus(true);
    if (recovered) {
      socketErrorToastAt = 0;
      broadcastOperatorNotice({
        kind: "success",
        title: "Connected",
        detail: "Athens socket is online.",
      });
    }
  },
  onDisconnected: () => {
    pushSocketStatus(false);
  },
  onConnectError: (err) => {
    if (isAcornSocketConnected()) return;
    pushSocketStatus(false);
    const now = Date.now();
    if (now - socketErrorToastAt < SOCKET_TOAST_MS) return;
    socketErrorToastAt = now;
    broadcastOperatorNotice({
      kind: "error",
      title: "Couldn’t connect",
      detail: socketErrorDetail(err.message),
    });
  },
};

function connectSocket(): Promise<void> {
  return connectAcornSocket(socketHandlers);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    if (sidebarPorts.size > 0) void chrome.runtime.getPlatformInfo();
    if (!isAcornSocketConnected()) void connectSocket().catch(() => undefined);
  }
  if (alarm.name === WORK_KEEP_ALIVE_ALARM) {
    if (anyTabWorking()) void chrome.runtime.getPlatformInfo();
    else void chrome.alarms.clear(WORK_KEEP_ALIVE_ALARM);
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== ACORN_SIDEBAR_PORT) return;
  sidebarPorts.add(port);
  try {
    port.postMessage({
      type: MSG.SOCKET_STATUS,
      connected: isAcornSocketConnected(),
    });
  } catch {
    sidebarPorts.delete(port);
    return;
  }
  void connectSocket().catch(() => undefined);
  port.onDisconnect.addListener(() => {
    sidebarPorts.delete(port);
  });
});

void connectSocket().catch(() => undefined);
enableSidePanelOnActionClick();
bindContentScriptInjection();
void injectIntoOpenTabs();
chrome.runtime.onInstalled.addListener(enableSidePanelOnActionClick);

chrome.tabs.onRemoved.addListener((tabId) => {
  void unbindTabJob(tabId);
  void unbindCustomTab(tabId);
  void clearTabPipeline(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  if (pipelineRunningTabIds.delete(removedTabId)) {
    pipelineRunningTabIds.add(addedTabId);
  }
  if (customGenerateTabIds.delete(removedTabId)) {
    customGenerateTabIds.add(addedTabId);
  }
  rekeyPipelineUsage(removedTabId, addedTabId);
  void rekeyTabJob(removedTabId, addedTabId);
  void rekeyCustomTab(removedTabId, addedTabId);
  void rekeyTabPipeline(removedTabId, addedTabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    !changeInfo.url &&
    !changeInfo.title &&
    !changeInfo.favIconUrl &&
    changeInfo.status !== "complete"
  ) {
    return;
  }
  void refreshCustomTabMeta(tabId, {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
  });
});

// Joined is the one place a person signs in or out: follow its cookie.
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (isJoinedSessionCookie(cookie)) void syncJoinedSession();
});
void syncJoinedSession();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.athensApiUrl || changes.acornSession) {
    scheduleConnectAcornSocket(socketHandlers);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MSG.SOCKET_STATUS) {
    sendResponse({ connected: isAcornSocketConnected() });
    return true;
  }

  if (message.type === MSG.AUTH_STATUS) {
    void syncJoinedSession()
      .then(getAcornSession)
      .then((session) => {
        sendResponse({
          signedIn: Boolean(session),
          session,
          connected: isAcornSocketConnected(),
        });
      });
    return true;
  }

  if (message.type === MSG.AUTH_SIGNIN) {
    void (async () => {
      const result = await acornSignIn(
        typeof message.apiUrl === "string" ? message.apiUrl : undefined,
      );
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error });
        return;
      }
      await connectSocket().catch(() => undefined);
      sendResponse({ ok: true, session: result.session });
    })();
    return true;
  }

  if (message.type === MSG.AUTH_SIGNOUT) {
    void (async () => {
      try {
        await acornSignOut();
        await connectSocket().catch(() => undefined);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }

  if (message.type === MSG.LIST_WORKER_JOBS) {
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          sendResponse({ ok: false, error: "Sign in required", jobs: [] });
          return;
        }
        const base = await getAthensApiUrl();
        const res = await fetch(`${base}/acorn/jobs`, {
          headers: await authHeaders(),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          jobs?: unknown[];
          message?: string;
          error?: string;
        };
        if (!res.ok) {
          sendResponse({
            ok: false,
            error: data.message || data.error || `Jobs failed (${res.status})`,
            jobs: [],
          });
          return;
        }
        sendResponse({ ok: true, jobs: mapAcornWorkerJobs(data.jobs) });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          jobs: [],
        });
      }
    })();
    return true;
  }

  if (message.type === MSG.OPEN_WORKER_JOB) {
    void (async () => {
      try {
        const applyUrl = String(message.applyUrl || "").trim();
        const jobId = String(message.jobId || "").trim();
        if (!jobId) {
          sendResponse({ ok: false, error: "Missing job id" });
          return;
        }
        if (!applyUrl) {
          sendResponse({ ok: false, error: "This job has no apply URL" });
          return;
        }
        const preferredTabId = await resolvePreferredTabId(sender, message.tabId);
        const attachedTabId =
          typeof message.attachedTabId === "number" && Number.isFinite(message.attachedTabId)
            ? message.attachedTabId
            : null;
        const opened = await openWorkerJobInTab({
          preferredTabId,
          attachedTabId,
          job: {
            jobId,
            resumeId:
              typeof message.resumeId === "string" && message.resumeId.trim()
                ? message.resumeId.trim()
                : null,
            resumeStack:
              typeof message.resumeStack === "string" && message.resumeStack.trim()
                ? message.resumeStack.trim()
                : null,
            applyUrl,
            title: String(message.title || ""),
            company: String(message.company || ""),
          },
        });
        sendResponse({ ok: true, tabId: opened.tabId, reused: opened.reused });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }

  if (message.type === MSG.MARK_JOB_APPLIED) {
    void (async () => {
      try {
        const jobId = String(message.jobId || "").trim();
        if (!jobId) {
          sendResponse({ ok: false, error: "Missing job id" });
          return;
        }
        const token = await getAccessToken();
        if (!token) {
          sendResponse({ ok: false, error: "Sign in required" });
          return;
        }
        const attachedTabIds = await findTabIdsForJob(jobId);
        await unbindJobFromAllTabs(jobId);
        void closeTabsQuietly(attachedTabIds);
        const base = await getAthensApiUrl();
        const res = await fetch(`${base}/acorn/jobs/${encodeURIComponent(jobId)}/mark-applied`, {
          method: "POST",
          headers: await authHeaders(),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          error?: string;
        };
        if (!res.ok || data.success === false) {
          sendResponse({
            ok: false,
            error: data.message || data.error || `Mark applied failed (${res.status})`,
          });
          return;
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }

  if (message.type === MSG.GET_TAB_JOB) {
    void (async () => {
      let tabId = typeof message.tabId === "number" ? message.tabId : (sender.tab?.id ?? null);
      if (!tabId) {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = tab?.id ?? null;
      }
      if (!tabId) {
        sendResponse({ ok: false, job: null });
        return;
      }
      sendResponse({ ok: true, job: await getTabJob(tabId) });
    })();
    return true;
  }

  if (message.type === MSG.SELECTION_QA) {
    void (async () => {
      try {
        const session = await getAcornSession();
        if (!session) {
          sendResponse({ ok: false, error: "Sign in to Acorn" });
          return;
        }
        const question = String(message.question || "").trim();
        if (!question) {
          sendResponse({ ok: false, error: "Select some text first." });
          return;
        }
        const tabId = sender.tab?.id;
        const tabJob = typeof tabId === "number" ? await getTabJob(tabId) : null;
        const answer = await requestQaAnswer({
          question,
          page: {
            title: String(message.title || ""),
            url: String(message.url || ""),
            job: tabJob
              ? {
                  id: tabJob.jobId,
                  title: tabJob.title,
                  company: tabJob.company,
                }
              : null,
          },
        });
        sendResponse({ ok: true, answer });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        sendResponse({
          ok: false,
          error: /sign in/i.test(detail) ? "Sign in to Acorn" : detail,
        });
      }
    })();
    return true;
  }

  if (message.type === MSG.REMEMBER_CUSTOM_TAB) {
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
    return true;
  }

  if (message.type === MSG.FORGET_CUSTOM_TAB) {
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
    return true;
  }

  if (message.type === MSG.FOCUS_CUSTOM_TAB) {
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
    return true;
  }

  if (message.type === MSG.START_CUSTOM_GENERATE) {
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
          throw new Error("Sign in to Athens in the Acorn sidebar first");
        }
        const apiUrl = await getAthensApiUrl();
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
    return true;
  }

  if (message.type === MSG.START_CUSTOM_RECOMMEND) {
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
          throw new Error("Sign in to Athens in the Acorn sidebar first");
        }
        const apiUrl = await getAthensApiUrl();
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
    return true;
  }

  if (message.type === MSG.START_JOB_GENERATE || message.type === MSG.START_JOB_RECOMMEND) {
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
          throw new Error("Sign in to Athens in the Acorn sidebar first");
        }
        const apiUrl = await getAthensApiUrl();
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
    return true;
  }

  if (message.type === "acorn:reconnect-socket") {
    void connectSocket()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === MSG.START_PIPELINE) {
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
            error: "Sign in to Athens in the Acorn sidebar first",
          });
          return;
        }

        const apiUrl = await getAthensApiUrl();
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

    return true;
  }

  if (message.type === MSG.MATCH_OPTION) {
    const incoming = message.payload as MatchOptionRequest;
    const usageTabId = sender.tab?.id;
    (async () => {
      try {
        const base = await getAthensApiUrl();
        const payload: Record<string, unknown> = {
          intendedValue: incoming.intendedValue,
          options: incoming.options.filter(
            (opt): opt is string => typeof opt === "string" && opt.trim().length > 0,
          ),
        };
        if (typeof incoming.fieldLabel === "string" && incoming.fieldLabel.trim()) {
          payload.fieldLabel = incoming.fieldLabel;
        }
        if (typeof incoming.typedQuery === "string" && incoming.typedQuery.trim()) {
          payload.typedQuery = incoming.typedQuery;
        }
        const res = await fetch(`${base}/acorn/match-option`, {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as MatchOptionResponse;
        if (!res.ok) {
          sendResponse({
            ok: false,
            matched_option: null,
            error: data.error || `match-option failed: ${res.status}`,
          } satisfies MatchOptionResponse);
          return;
        }
        if (usageTabId != null && pipelineRunningTabIds.has(usageTabId) && data.usage) {
          addPipelineUsage(usageTabId, data.usage);
        }
        let reply: MatchOptionResponse = { ...data, ok: data.ok !== false };
        const listed = (payload.options as string[]) || [];
        let fromAnalyze: string | null = null;
        if (reply.ok && !reply.matched_option && listed.length) {
          fromAnalyze = await matchOptionViaAnalyze({
            intendedValue: String(incoming.intendedValue || ""),
            options: listed,
            fieldLabel: typeof incoming.fieldLabel === "string" ? incoming.fieldLabel : "",
            apiUrl: base,
          }).catch(() => null);
          if (fromAnalyze) {
            reply = { ...reply, matched_option: fromAnalyze, ok: true };
          }
        }
        sendResponse(reply);
      } catch (err) {
        sendResponse({
          ok: false,
          matched_option: null,
          error: err instanceof Error ? err.message : String(err),
        } satisfies MatchOptionResponse);
      }
    })();
    return true;
  }

  if (message.type === MSG.FETCH_DOM || message.type === MSG.FETCH_AND_EMIT_DOM) {
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
    return true;
  }
});
