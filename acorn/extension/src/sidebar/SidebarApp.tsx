import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { canContinueGenerate } from "@acorn/shared/generate-checkpoint";
import {
  IDLE_PIPELINE_PROGRESS,
  isFillPhaseBusy,
  mergePipelineProgress,
  type PipelineProgress,
} from "@acorn/shared/pipeline-types";
import type { ActionPlan, RunStepRecord } from "@acorn/shared/plan-runner/types";
import {
  collectLines,
  formatMetaTreePreview,
  formatPureTreePreview,
  iterateMetaTreeLines,
  iteratePureTreeLines,
  splitDomTree,
  type DomTreeNode,
} from "@acorn/shared/tree-export";
import {
  DEFAULT_ATHENS_API_URL,
  getAthensApiUrl,
  getAcornSession,
  setAthensApiUrl,
  type AcornStoredSession,
} from "../auth/acorn-auth";
import {
  fetchCustomLibraryResume,
  fetchCustomLibraryResumePreview,
  fetchCustomResume,
  fetchCustomResumePreview,
  fetchGeneratedResumePreview,
  fetchRecommendedResume,
} from "../pipeline/ai-client";
import {
  customTabHasResume,
  patchCustomTab,
  type CustomResumeMode,
  type AcornCustomTabBinding,
} from "../tab-custom-session";
import { MSG, ACORN_SIDEBAR_PORT, type DomNode, type PipelineSource } from "../types";
import { InspectPanel, useInspectWindow } from "./InspectPanel";
import { LoadMoreFooter } from "./LoadMoreFooter";
import { QaPanel } from "./QaPanel";
import { ResumePreviewPanel, type ResumePreviewDownload } from "./ResumePreviewPanel";
import { SidebarMainTabs, type AcornMainTab } from "./SidebarMainTabs";
import { sendMessage } from "./runtime";
import { clearTabTree, getTabTree, setTabTree, type TabTreeSummary } from "./tab-tree-cache";
import { useActiveTabId } from "./use-active-tab";
import { useShownCount } from "./use-shown-count";
import { useTabSession } from "./use-tab-session";
import { CustomTabList } from "./CustomTabList";
import { FaceGuidePanel } from "./FaceGuidePanel";
import { pushAcornNotice } from "./acorn-notice";
import { HelpIcon } from "./sidebar-icons";
import { SidebarActionBar } from "./SidebarActionBar";
import { WorkerPoolList, type AcornWorkerJob } from "./WorkerPoolList";
import { ACORN_FACE_BADGE_PX, ACORN_FACE_BRAND_PX } from "../acorn-face/constants";
import { countBusyWorkers, tabInputFromProgress } from "../acorn-face/director";
import { AcornFaceView } from "../acorn-face/AcornFaceView";
import { useCompanionFace } from "../acorn-face/use-companion-face";
import "./SidebarApp.css";

type InspectKind = "pure" | "meta" | "plan";

type ResumePreviewRequest = {
  title: string;
  sourceKey: string;
  loadHtml: () => Promise<string>;
  downloadFile: () => Promise<ResumePreviewDownload>;
};

type TabUi = {
  lastFetch: TabTreeSummary | null;
  inspect: { title: string; kind: InspectKind } | null;
};

const EMPTY_TAB_UI: TabUi = {
  lastFetch: null,
  inspect: null,
};

const STEP_PAGE = 30;

export default function SidebarApp() {
  const activeTabId = useActiveTabId();
  const {
    tabJob,
    customTab,
    customList,
    jobGenerates,
    pipelines,
    progress,
    attachments,
    setPipelines,
  } = useTabSession(activeTabId);

  const [apiUrl, setApiUrl] = useState(DEFAULT_ATHENS_API_URL);
  const [session, setSession] = useState<AcornStoredSession | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tabUi, setTabUi] = useState<Record<string, TabUi>>({});
  const [workerJobs, setWorkerJobs] = useState<AcornWorkerJob[]>([]);
  const [workerJobsLoading, setWorkerJobsLoading] = useState(false);
  const [workerJobsError, setWorkerJobsError] = useState<string | null>(null);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  const [markingJobId, setMarkingJobId] = useState<string | null>(null);
  const [jobsListKey, setJobsListKey] = useState(0);
  const [preview, setPreview] = useState<ResumePreviewRequest | null>(null);
  const [jdPreview, setJdPreview] = useState<{ title: string; text: string } | null>(null);
  const [mainTab, setMainTab] = useState<AcornMainTab>("fill");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [qaStatus, setQaStatus] = useState({ busy: false, error: false });
  const [remembering, setRemembering] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customResumeMode, setCustomResumeMode] = useState<CustomResumeMode>("generate");

  const tabKey = activeTabId != null ? String(activeTabId) : null;
  const ui = (tabKey && tabUi[tabKey]) || EMPTY_TAB_UI;
  const fillBusy = isFillPhaseBusy(progress.phase);
  const generateBusy =
    customTab?.generateStatus === "queued" ||
    customTab?.generateStatus === "running" ||
    (tabJob != null &&
      (jobGenerates[tabJob.jobId]?.generateStatus === "queued" ||
        jobGenerates[tabJob.jobId]?.generateStatus === "running"));
  const tabWorkBusy = fillBusy || generateBusy;
  const anyTabWorking =
    Object.values(pipelines).some((row) => isFillPhaseBusy(row.phase)) ||
    customList.some((tab) => tab.generateStatus === "queued" || tab.generateStatus === "running") ||
    Object.values(jobGenerates).some(
      (row) => row.generateStatus === "queued" || row.generateStatus === "running",
    );
  const busyCounts = useMemo(
    () => countBusyWorkers(pipelines, customList, Object.values(jobGenerates)),
    [pipelines, customList, jobGenerates],
  );
  const busyTotal = busyCounts.thinking + busyCounts.working;
  const workersMode =
    busyCounts.working > 0 ? "working" : busyCounts.thinking > 0 ? "thinking" : "waiting";
  const fillErrorText =
    progress.phase === "error" ? progress.error || progress.message || "Fill failed" : null;

  useEffect(() => {
    if (!fillErrorText) return;
    pushAcornNotice({
      kind: "error",
      title: "Fill couldn’t finish",
      detail: fillErrorText,
    });
  }, [fillErrorText]);

  useEffect(() => {
    if (customTab == null) return;
    setCustomResumeMode(customTab.resumeMode);
  }, [customTab?.tabId, customTab?.resumeMode]);

  const patchTabUi = useCallback((tabId: number, patch: Partial<TabUi>) => {
    setTabUi((prev) => {
      const key = String(tabId);
      return { ...prev, [key]: { ...(prev[key] ?? EMPTY_TAB_UI), ...patch } };
    });
  }, []);

  const openJobResumePreview = useCallback(
    (job: AcornWorkerJob) => {
      const generationId = String(jobGenerates[job.id]?.generationId || "").trim();
      setPreview({
        title: job.title,
        sourceKey: generationId ? `job-gen:${generationId}` : `job:${job.id}`,
        loadHtml: () =>
          generationId
            ? fetchCustomResumePreview(generationId)
            : fetchGeneratedResumePreview(job.id),
        downloadFile: async () => {
          if (generationId) {
            const file = await fetchCustomResume(generationId);
            if (!file?.base64 || !file.name) {
              throw new Error("Could not download the generated résumé");
            }
            return file;
          }
          const file = await fetchRecommendedResume(job.id);
          if (!file?.base64 || !file.name) {
            throw new Error(
              job.generatedResume
                ? "Could not download the generated résumé"
                : "Could not download the Library résumé",
            );
          }
          return file;
        },
      });
    },
    [jobGenerates],
  );

  const openCustomResumePreview = useCallback((tab: AcornCustomTabBinding) => {
    if (tab.resumeMode === "recommend") {
      const resumeId = String(tab.recommendedResumeId || "").trim();
      if (!resumeId) return;
      setPreview({
        title: tab.title || "Untitled",
        sourceKey: `custom-library:${resumeId}`,
        loadHtml: () => fetchCustomLibraryResumePreview(resumeId),
        downloadFile: async () => {
          const file = await fetchCustomLibraryResume(resumeId);
          if (!file?.base64 || !file.name) {
            throw new Error("Could not download the Library résumé");
          }
          return file;
        },
      });
      return;
    }
    const generationId = String(tab.generationId || "").trim();
    if (!generationId) return;
    setPreview({
      title: tab.title || "Untitled",
      sourceKey: `custom:${generationId}:${String(tab.resumeId || "")}`,
      loadHtml: () => fetchCustomResumePreview(generationId),
      downloadFile: async () => {
        const file = await fetchCustomResume(generationId);
        if (!file?.base64 || !file.name) {
          throw new Error("Could not download the stored editor résumé");
        }
        return file;
      },
    });
  }, []);

  const setTabProgress = useCallback(
    (tabId: number, next: PipelineProgress) => {
      setPipelines((prev) => {
        const key = String(tabId);
        return {
          ...prev,
          [key]: mergePipelineProgress(prev[key] ?? IDLE_PIPELINE_PROGRESS, next),
        };
      });
    },
    [setPipelines],
  );

  useEffect(() => {
    void (async () => {
      setApiUrl(await getAthensApiUrl());
      setSession(await getAcornSession());
    })();
  }, []);

  useEffect(() => {
    const onRemoved = (tabId: number) => {
      clearTabTree(tabId);
      setTabUi((prev) => {
        const key = String(tabId);
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
    chrome.tabs.onRemoved.addListener(onRemoved);
    return () => chrome.tabs.onRemoved.removeListener(onRemoved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let port: chrome.runtime.Port | null = null;

    const attach = () => {
      if (cancelled) return;
      port = chrome.runtime.connect({ name: ACORN_SIDEBAR_PORT });
      port.onMessage.addListener((message: { type?: string; connected?: boolean }) => {
        if (message?.type === MSG.SOCKET_STATUS) {
          setConnected(Boolean(message.connected));
        }
      });
      port.onDisconnect.addListener(() => {
        port = null;
        if (!cancelled) window.setTimeout(attach, 250);
      });
    };

    attach();
    return () => {
      cancelled = true;
      port?.disconnect();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const res = await sendMessage<{ connected?: boolean }>({ type: MSG.SOCKET_STATUS });
        if (alive && typeof res?.connected === "boolean") {
          setConnected(res.connected);
        }
      } catch {
        if (alive) setConnected(false);
      }
    };

    check();
    const id = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [session, apiUrl]);

  const cacheTree = useCallback(
    (
      tabId: number,
      payload: { url: string; title: string; fetchedAt: string; tree: DomTreeNode },
    ) => {
      const existing = getTabTree(tabId);
      if (existing?.fetchedAt === payload.fetchedAt) {
        patchTabUi(tabId, {
          lastFetch: {
            url: existing.url,
            title: existing.title,
            fetchedAt: existing.fetchedAt,
            nodeCount: existing.nodeCount,
          },
        });
        return;
      }
      const nodeCount = countNodes(payload.tree as unknown as DomNode);
      const summary: TabTreeSummary = {
        url: payload.url,
        title: payload.title,
        fetchedAt: payload.fetchedAt,
        nodeCount,
      };
      setTabTree(tabId, { ...summary, tree: payload.tree });
      patchTabUi(tabId, { lastFetch: summary });
    },
    [patchTabUi],
  );

  useEffect(() => {
    if (activeTabId == null || !progress.tree) return;
    if (!isValidTree(progress.tree.tree)) return;
    cacheTree(activeTabId, {
      url: progress.tree.url,
      title: progress.tree.title,
      fetchedAt: progress.tree.fetchedAt,
      tree: progress.tree.tree,
    });
  }, [activeTabId, progress.tree, cacheTree]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      const res = await sendMessage<{
        ok?: boolean;
        error?: string;
        session?: AcornStoredSession;
      }>({
        type: MSG.AUTH_SIGNIN,
        apiUrl,
      });
      if (!res?.ok || !res.session) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t sign in",
          detail: res?.error || "Sign in to Joined in this browser first.",
        });
        return;
      }
      setSession(res.session);
      pushAcornNotice({
        kind: "success",
        title: "Signed in",
        detail: `Welcome back, ${res.session.displayName}.`,
      });
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t sign in",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      const res = await sendMessage<{ ok?: boolean; error?: string }>({
        type: MSG.AUTH_SIGNOUT,
      });
      if (!res?.ok) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t sign out",
          detail: res?.error || "Try again in a moment.",
        });
        return;
      }
      setSession(null);
      setHelpOpen(false);
      pushAcornNotice({ kind: "success", title: "Signed out" });
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t sign out",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const fetchWorkerJobs = useCallback(async () => {
    setWorkerJobsLoading(true);
    setWorkerJobsError(null);
    try {
      const res = await sendMessage<{
        ok?: boolean;
        error?: string;
        jobs?: AcornWorkerJob[];
      }>({ type: MSG.LIST_WORKER_JOBS });
      if (!res?.ok) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t load jobs",
          detail: res?.error || "Refresh and try again.",
        });
        setWorkerJobs([]);
        return;
      }
      setWorkerJobs(Array.isArray(res.jobs) ? res.jobs : []);
    } catch (err) {
      setWorkerJobs([]);
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t load jobs",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setWorkerJobsLoading(false);
      setJobsListKey((key) => key + 1);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setWorkerJobs([]);
      setWorkerJobsError(null);
      setJobsListKey((key) => key + 1);
      return;
    }
    void fetchWorkerJobs();
  }, [session, fetchWorkerJobs]);

  const openWorkerJob = useCallback(
    async (job: AcornWorkerJob) => {
      setOpeningJobId(job.id);
      try {
        const res = await sendMessage<{
          ok?: boolean;
          error?: string;
          tabId?: number;
          reused?: boolean;
        }>({
          type: MSG.OPEN_WORKER_JOB,
          tabId: activeTabId,
          attachedTabId: attachments[job.id]?.tabId,
          jobId: job.id,
          applyUrl: job.applyUrl,
          resumeId: job.generatedResume ? null : job.recommendedResumeId,
          resumeStack: job.generatedResume ? "Generated" : job.recommendedResumeStack,
          title: job.title,
          company: job.company,
        });
        if (!res?.ok) {
          pushAcornNotice({
            kind: "error",
            title: "Couldn’t open job",
            detail: res?.error || "This job has no apply URL.",
          });
          return;
        }
        if (res.reused) return;
        pushAcornNotice({
          kind: "success",
          title: "Opened apply page",
          detail: `${job.company} — ${job.title}`,
        });
      } catch (err) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t open job",
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setOpeningJobId(null);
      }
    },
    [activeTabId, attachments],
  );

  const markJobApplied = useCallback(
    async (job: AcornWorkerJob) => {
      setMarkingJobId(job.id);
      setWorkerJobs((prev) => prev.filter((row) => row.id !== job.id));
      const attachedTabId = attachments[job.id]?.tabId;
      if (typeof attachedTabId === "number") {
        void chrome.tabs.remove(attachedTabId).catch(() => undefined);
      }
      try {
        const res = await sendMessage<{ ok?: boolean; error?: string }>({
          type: MSG.MARK_JOB_APPLIED,
          jobId: job.id,
        });
        if (!res?.ok) {
          throw new Error(res?.error || "Failed to mark as applied");
        }
        pushAcornNotice({
          kind: "success",
          title: "Marked applied",
          detail: `${job.company} — ${job.title}`,
        });
      } catch (err) {
        setWorkerJobs((prev) => {
          if (prev.some((row) => row.id === job.id)) return prev;
          return [job, ...prev];
        });
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t mark applied",
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setMarkingJobId(null);
      }
    },
    [attachments],
  );

  const startPipeline = useCallback(
    async (source: PipelineSource = "fill") => {
      const tabId = activeTabId;
      if (tabWorkBusy || tabId == null) return;
      if (source === "custom" && !customTab) {
        pushAcornNotice({
          kind: "info",
          title: "Remember this tab first",
          detail: "Custom Fill only runs on a remembered tab.",
        });
        return;
      }
      setTabProgress(tabId, { phase: "fetching", message: "Starting…" });
      try {
        const res = await sendMessage<{ ok?: boolean; error?: string }>({
          type: MSG.START_PIPELINE,
          tabId,
          source,
        });
        if (res?.error) {
          const err = String(res.error);
          if (/sign in/i.test(err)) {
            setTabProgress(tabId, {
              phase: "idle",
              message: "Sign in to Athens to run Acorn",
            });
            pushAcornNotice({
              kind: "error",
              title: "Sign in required",
              detail: "Sign in to run Fill.",
            });
            return;
          }
          setTabProgress(tabId, {
            phase: "error",
            message: "Failed to start",
            error: err,
          });
          return;
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setTabProgress(tabId, {
          phase: "error",
          message: "Failed to start",
          error: detail,
        });
      }
    },
    [activeTabId, customTab, tabWorkBusy, setTabProgress],
  );

  const rememberFocusedTab = useCallback(async () => {
    const tabId = activeTabId;
    if (tabId == null) return;
    setRemembering(true);
    try {
      const res = await sendMessage<{ ok?: boolean; error?: string }>({
        type: MSG.REMEMBER_CUSTOM_TAB,
        tabId,
        resumeMode: customResumeMode,
      });
      if (!res?.ok) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t remember tab",
          detail: res?.error || "Try again on this page.",
        });
        return;
      }
      pushAcornNotice({ kind: "success", title: "Tab remembered" });
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t remember tab",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRemembering(false);
    }
  }, [activeTabId, customResumeMode]);

  const forgetCustomTab = useCallback(async (tabId: number) => {
    void chrome.tabs.remove(tabId).catch(() => undefined);
    try {
      const res = await sendMessage<{ ok?: boolean; error?: string }>({
        type: MSG.FORGET_CUSTOM_TAB,
        tabId,
      });
      if (!res?.ok) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t forget tab",
          detail: res?.error || "Try again.",
        });
      }
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t forget tab",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const focusCustomTab = useCallback(async (tabId: number) => {
    try {
      const res = await sendMessage<{ ok?: boolean; error?: string }>({
        type: MSG.FOCUS_CUSTOM_TAB,
        tabId,
      });
      if (!res?.ok) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t switch tab",
          detail: res?.error || "That tab is no longer open.",
        });
      }
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t switch tab",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const startJobWork = useCallback(
    async (mode: CustomResumeMode, opts: { continue?: boolean; job?: AcornWorkerJob } = {}) => {
      const job = opts.job ?? workerJobs.find((row) => row.id === tabJob?.jobId) ?? null;
      if (!job) {
        pushAcornNotice({
          kind: "info",
          title: "Open a Worker pool job first",
          detail: "Fill Generate uses the stored JD on that list item.",
        });
        return;
      }
      setCustomResumeMode(mode);
      try {
        const res = await sendMessage<{ ok?: boolean; error?: string }>({
          type: mode === "recommend" ? MSG.START_JOB_RECOMMEND : MSG.START_JOB_GENERATE,
          jobId: job.id,
          tabId: activeTabId,
          continue: Boolean(opts.continue),
          jobDescription: job.jobDescription,
        });
        if (!res?.ok) {
          pushAcornNotice({
            kind: "error",
            title: mode === "recommend" ? "Couldn’t recommend" : "Couldn’t generate",
            detail: res?.error || "Try again.",
          });
        }
      } catch (err) {
        pushAcornNotice({
          kind: "error",
          title: mode === "recommend" ? "Couldn’t recommend" : "Couldn’t generate",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [activeTabId, tabJob?.jobId, workerJobs],
  );

  const startCustomWork = useCallback(
    async (
      mode: CustomResumeMode,
      opts: { continue?: boolean; tab?: AcornCustomTabBinding } = {},
    ) => {
      const tabId = opts.tab?.tabId ?? activeTabId;
      if (tabId == null) return;
      if (!opts.tab && tabWorkBusy) return;
      if (mainTab === "fill") {
        await startJobWork(mode, { continue: opts.continue });
        return;
      }
      if (!customTab && !opts.tab) return;
      setCustomResumeMode(mode);
      try {
        if (!customTab && !opts.tab) {
          const remembered = await sendMessage<{ ok?: boolean; error?: string }>({
            type: MSG.REMEMBER_CUSTOM_TAB,
            tabId,
            resumeMode: mode,
          });
          if (!remembered?.ok) {
            pushAcornNotice({
              kind: "error",
              title: mode === "recommend" ? "Couldn’t recommend" : "Couldn’t generate",
              detail: remembered?.error || "Try again on this page.",
            });
            return;
          }
        } else if ((opts.tab ?? customTab)?.resumeMode !== mode) {
          await patchCustomTab(tabId, { resumeMode: mode });
        }
        const res = await sendMessage<{ ok?: boolean; error?: string }>({
          type: mode === "recommend" ? MSG.START_CUSTOM_RECOMMEND : MSG.START_CUSTOM_GENERATE,
          tabId,
          continue: Boolean(opts.continue),
        });
        if (!res?.ok) {
          pushAcornNotice({
            kind: "error",
            title: mode === "recommend" ? "Couldn’t recommend" : "Couldn’t generate",
            detail: res?.error || "Try again on this page.",
          });
        }
      } catch (err) {
        pushAcornNotice({
          kind: "error",
          title: mode === "recommend" ? "Couldn’t recommend" : "Couldn’t generate",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [activeTabId, customTab, mainTab, startJobWork, tabWorkBusy],
  );

  const lastFetch = ui.lastFetch;
  const inspectKind = ui.inspect?.kind ?? null;
  const treeStamp = lastFetch?.fetchedAt;

  const splitTrees = useMemo(() => {
    if (inspectKind !== "pure" && inspectKind !== "meta") return null;
    if (activeTabId == null) return null;
    const tree = getTabTree(activeTabId)?.tree;
    if (!tree) return null;
    return splitDomTree(tree);
  }, [inspectKind, activeTabId, treeStamp]);

  const plan: ActionPlan | undefined = progress.plan;
  const steps: RunStepRecord[] = progress.steps ?? [];
  const nodeCount = lastFetch?.nodeCount ?? 0;

  const {
    shownCount: stepShown,
    loadMore: loadMoreSteps,
    ensureCount: ensureStepCount,
  } = useShownCount(STEP_PAGE, plan);
  const visibleSteps = steps.slice(0, stepShown);
  const hasMoreSteps = stepShown < steps.length;
  const stepsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const runningIdx = steps.findIndex(
      (step) => step.status === "running" || step.status === "paused",
    );
    if (runningIdx >= 0) ensureStepCount(runningIdx + 1);
  }, [steps, ensureStepCount]);

  const inspectWindow = useInspectWindow(inspectKind);

  const inspectView = useMemo(() => {
    if (!inspectKind) return null;
    if (inspectKind === "plan") {
      const all = JSON.stringify(plan ?? {}, null, 2).split("\n");
      return {
        lines: all.slice(0, inspectWindow.shownCount),
        hasMore: inspectWindow.shownCount < all.length,
        copy: () => navigator.clipboard.writeText(all.join("\n")),
      };
    }
    if (!splitTrees) return { lines: [] as string[], hasMore: false, copy: async () => undefined };
    if (inspectKind === "pure") {
      const collected = collectLines(
        iteratePureTreeLines(splitTrees.pure),
        inspectWindow.shownCount,
      );
      return {
        ...collected,
        copy: () => navigator.clipboard.writeText(formatPureTreePreview(splitTrees.pure)),
      };
    }
    const collected = collectLines(
      iterateMetaTreeLines(splitTrees.meta, splitTrees.pure),
      inspectWindow.shownCount,
    );
    return {
      ...collected,
      copy: () =>
        navigator.clipboard.writeText(formatMetaTreePreview(splitTrees.meta, splitTrees.pure)),
    };
  }, [inspectKind, inspectWindow.shownCount, plan, splitTrees]);

  const stepSummary = {
    ok: steps.filter((s) => s.status === "ok").length,
    skipped: steps.filter((s) => s.status === "skipped").length,
    blocked: steps.filter((s) => s.status === "blocked").length,
    failed: steps.filter((s) => s.status === "failed" || s.status === "aborted").length,
  };

  const openInspect = (kind: InspectKind, title: string) => {
    if (activeTabId == null) return;
    patchTabUi(activeTabId, { inspect: { title, kind } });
  };

  const connectionLabel = connected ? "Connected" : session ? "Offline" : "Sign in";
  const footerStatus = fillBusy ? progress.message : connectionLabel;
  const hasTree = Boolean(lastFetch);
  const companionMode = useCompanionFace({
    signedIn: Boolean(session),
    authBusy,
    nameFocused: false,
    connected,
    anyTabWorking,
    focused: tabInputFromProgress(Boolean(session), progress, {
      status: customTab?.generateStatus ?? null,
      label: customTab?.generateProgress?.label ?? null,
      hasResume: customTab ? customTabHasResume(customTab) : false,
    }),
    qaBusy: qaStatus.busy,
    qaError: qaStatus.error,
    inspectOpen: Boolean(ui.inspect || preview || helpOpen),
    connectionOpen,
    jobsLoading: workerJobsLoading,
    jobsEmpty:
      Boolean(session) &&
      mainTab === "fill" &&
      !workerJobsLoading &&
      !workerJobsError &&
      workerJobs.length === 0,
    jobsError: Boolean(workerJobsError),
    customEmpty: Boolean(session) && mainTab === "custom" && customList.length === 0,
    opening: Boolean(openingJobId) || remembering,
    marking: Boolean(markingJobId),
  });

  const showActionBar = Boolean(session) && mainTab !== "qa" && !helpOpen;
  const customLocked = mainTab === "custom" && !customTab;
  const fillLocked = mainTab === "fill" && !tabJob;
  const rememberFirst = "Remember this tab first";
  const openJobFirst = "Open a Worker pool job first";
  const actionsOff = tabWorkBusy || !session || activeTabId == null || customLocked;
  const attachedJobGenerate = tabJob ? (jobGenerates[tabJob.jobId] ?? null) : null;
  const fillCanContinue = canContinueGenerate(
    attachedJobGenerate?.generateStatus,
    attachedJobGenerate?.checkpoint,
  );
  const customCanContinue = canContinueGenerate(customTab?.generateStatus, customTab?.checkpoint);
  const generateBusyFill =
    attachedJobGenerate?.generateStatus === "queued" ||
    attachedJobGenerate?.generateStatus === "running";
  const generateLabel =
    mainTab === "fill"
      ? generateBusyFill && attachedJobGenerate?.workKind !== "recommend"
        ? "Generating…"
        : fillCanContinue && attachedJobGenerate?.workKind !== "recommend"
          ? "Continue"
          : attachedJobGenerate?.generationId ||
              (tabJob != null &&
                Boolean(workerJobs.find((job) => job.id === tabJob.jobId)?.generatedResume))
            ? "Generate again"
            : "Generate"
      : generateBusy && customTab?.workKind !== "recommend"
        ? "Generating…"
        : customCanContinue && customTab?.workKind !== "recommend"
          ? "Continue"
          : customTab?.generationId
            ? "Generate again"
            : "Generate";
  const recommendLabel =
    mainTab === "fill"
      ? generateBusyFill && attachedJobGenerate?.workKind === "recommend"
        ? "Recommending…"
        : fillCanContinue && attachedJobGenerate?.workKind === "recommend"
          ? "Continue"
          : attachedJobGenerate?.recommendedResumeId ||
              (tabJob && workerJobs.find((job) => job.id === tabJob.jobId)?.recommendedResumeId)
            ? "Recommend again"
            : "Recommend"
      : generateBusy && customTab?.workKind === "recommend"
        ? "Recommending…"
        : customCanContinue && customTab?.workKind === "recommend"
          ? "Continue"
          : customTab?.recommendedResumeId
            ? "Recommend again"
            : "Recommend";
  const fillLabel = fillBusy
    ? progress.message
    : progress.phase === "done"
      ? "Fill again"
      : "Fill page";

  return (
    <div
      className={`sidebar-app${session ? " signed-in" : ""} tab-${
        session ? mainTab : "fill"
      }${showActionBar ? " has-fill-cta" : ""}${helpOpen ? " help-open" : ""}`}
    >
      <div className="sidebar-scroll">
        <div className="sidebar-chrome">
          <section
            className="welcome"
            style={{ "--acorn-face-brand-px": `${ACORN_FACE_BRAND_PX}px` } as CSSProperties}
          >
            <div className="brand-bar">
              <AcornFaceView
                className="brand-logo"
                mode={companionMode}
                size={ACORN_FACE_BRAND_PX}
                live
                label="Acorn"
              />
              <h2>Acorn</h2>
              {session ? (
                <>
                  <p className="brand-user">{session.displayName}</p>
                  <div className="brand-actions">
                    <div
                      className={`brand-workers${busyTotal > 0 ? " is-busy" : ""}`}
                      role="status"
                      aria-live="polite"
                      title={
                        busyTotal > 0
                          ? `${busyTotal} working · ${busyCounts.thinking} thinking, ${busyCounts.working} filling`
                          : "No workers in flight"
                      }
                      aria-label={`${busyTotal} working`}
                    >
                      <AcornFaceView
                        className="brand-workers-face"
                        mode={workersMode}
                        size={ACORN_FACE_BADGE_PX}
                        live={busyTotal > 0}
                        label="Workers"
                      />
                      <span className="brand-workers-count">{busyTotal}</span>
                    </div>
                    <button
                      type="button"
                      className={`brand-icon-btn${helpOpen ? " is-open" : ""}`}
                      onClick={() => setHelpOpen((open) => !open)}
                      title={helpOpen ? "Close Acorn Face guide" : "Acorn Face guide"}
                      aria-label={helpOpen ? "Close Acorn Face guide" : "Acorn Face guide"}
                      aria-pressed={helpOpen}
                    >
                      <HelpIcon />
                    </button>
                    <button
                      type="button"
                      className="brand-icon-btn"
                      onClick={() => void handleSignOut()}
                      disabled={authBusy || anyTabWorking}
                      title="Sign out"
                      aria-label="Sign out"
                    >
                      <SignOutIcon />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          {session ? null : (
            <section className="connection">
              <div className="auth-form">
                <p className="auth-hint">
                  Acorn uses your Joined account. Sign in to Joined in this browser, then continue.
                </p>
                <button
                  type="button"
                  className="tool-card primary"
                  onClick={() => void handleSignIn()}
                  disabled={authBusy}
                >
                  {authBusy ? "Connecting…" : "Continue with Joined"}
                </button>
              </div>
            </section>
          )}
        </div>

        {helpOpen ? (
          <FaceGuidePanel thinking={busyCounts.thinking} working={busyCounts.working} />
        ) : (
          <>
            <section className="tools">
              {session ? <SidebarMainTabs value={mainTab} onChange={setMainTab} /> : <h3>Fill</h3>}
              {session ? (
                <div
                  id="acorn-panel-qa"
                  className="sidebar-tab-panel"
                  role="tabpanel"
                  aria-labelledby="acorn-tab-qa"
                  hidden={mainTab !== "qa"}
                >
                  <QaPanel
                    signedIn
                    showHeading={false}
                    disabled={fillBusy}
                    onStatus={setQaStatus}
                    page={
                      tabJob
                        ? {
                            job: {
                              id: tabJob.jobId,
                              title: tabJob.title,
                              company: tabJob.company,
                            },
                          }
                        : null
                    }
                  />
                </div>
              ) : null}

              {session ? (
                <div
                  id="acorn-panel-custom"
                  className="sidebar-tab-panel"
                  role="tabpanel"
                  aria-labelledby="acorn-tab-custom"
                  hidden={mainTab !== "custom"}
                >
                  <button
                    type="button"
                    className="tool-card"
                    onClick={() => void rememberFocusedTab()}
                    disabled={!session || activeTabId == null || Boolean(customTab) || tabWorkBusy}
                  >
                    <span className="tool-label">
                      {customTab ? "Tab remembered" : "Remember tab"}
                    </span>
                  </button>
                </div>
              ) : null}
            </section>

            {session ? (
              <div className="sidebar-list-slot" hidden={mainTab !== "custom"}>
                <CustomTabList
                  tabs={customList}
                  pipelines={pipelines}
                  activeTabId={activeTabId}
                  listActive={mainTab === "custom"}
                  onFocus={(tabId) => void focusCustomTab(tabId)}
                  onForget={(tabId) => void forgetCustomTab(tabId)}
                  onPreview={openCustomResumePreview}
                  onContinueGenerate={(tab) =>
                    void startCustomWork(tab.workKind === "recommend" ? "recommend" : "generate", {
                      continue: true,
                      tab,
                    })
                  }
                  onRestartGenerate={(tab) =>
                    void startCustomWork(tab.workKind === "recommend" ? "recommend" : "generate", {
                      continue: false,
                      tab,
                    })
                  }
                  onViewJd={(tab, jd) => setJdPreview({ title: tab.title || "Untitled", text: jd })}
                />
              </div>
            ) : null}

            {session ? (
              <div
                className="sidebar-list-slot"
                hidden={mainTab !== "fill"}
                id="acorn-panel-fill"
                role="tabpanel"
                aria-labelledby="acorn-tab-fill"
              >
                <WorkerPoolList
                  jobs={workerJobs}
                  loading={workerJobsLoading}
                  error={workerJobsError}
                  selectedJobId={tabJob?.jobId ?? null}
                  attachments={attachments}
                  pipelines={pipelines}
                  generates={jobGenerates}
                  openingJobId={openingJobId}
                  markingJobId={markingJobId}
                  listKey={jobsListKey}
                  listActive={mainTab === "fill"}
                  onRefresh={() => void fetchWorkerJobs()}
                  onOpen={(job) => void openWorkerJob(job)}
                  onPreviewResume={openJobResumePreview}
                  onMarkApplied={(job) => void markJobApplied(job)}
                  onContinueGenerate={(job) =>
                    void startJobWork(
                      jobGenerates[job.id]?.workKind === "recommend" ? "recommend" : "generate",
                      { continue: true, job },
                    )
                  }
                  onRestartGenerate={(job) =>
                    void startJobWork(
                      jobGenerates[job.id]?.workKind === "recommend" ? "recommend" : "generate",
                      { continue: false, job },
                    )
                  }
                  onViewJd={(job, jd) => setJdPreview({ title: job.title, text: jd })}
                />
              </div>
            ) : null}

            <div className="sidebar-after">
              {lastFetch ? (
                <section className="preview">
                  <h3>Analyzed tree</h3>
                  <div className="preview-card">
                    <div className="preview-title">{String(lastFetch.title ?? "Untitled")}</div>
                    <div className="preview-url">{String(lastFetch.url ?? "")}</div>
                    <div className="preview-meta">
                      <span>{nodeCount} nodes</span>
                      <span>{new Date(lastFetch.fetchedAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="tree-actions">
                      <button
                        type="button"
                        disabled={!hasTree}
                        onClick={() => openInspect("pure", "Pure Tree")}
                      >
                        Pure Tree
                      </button>
                      <button
                        type="button"
                        disabled={!hasTree}
                        onClick={() => openInspect("meta", "Meta Tree")}
                      >
                        Meta Tree
                      </button>
                      <button
                        type="button"
                        disabled={!plan}
                        onClick={() => openInspect("plan", "AI Analyze")}
                      >
                        {plan ? "AI Analyze" : "AI Analyze (pending)"}
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              {steps.length > 0 ? (
                <section className="plan-run">
                  <h3>Plan run</h3>
                  {plan?.goal && <p className="plan-goal">{plan.goal}</p>}
                  <div className="plan-run-summary">
                    <span>ok {stepSummary.ok}</span>
                    <span>skipped {stepSummary.skipped}</span>
                    <span>blocked {stepSummary.blocked}</span>
                    <span>failed {stepSummary.failed}</span>
                    {fillBusy && <span className="plan-run-live">running…</span>}
                  </div>
                  <div ref={stepsListRef} className="plan-run-scroll">
                    <ul className="plan-run-steps">
                      {visibleSteps.map((step) => (
                        <li key={step.index} className={`plan-step status-${step.status}`}>
                          <span className="plan-step-idx">{step.index + 1}</span>
                          <span className="plan-step-action">{step.action}</span>
                          <span className="plan-step-status">{stepStatusLabel(step)}</span>
                          <span className="plan-step-target">
                            {step.element_index != null ? `[${step.element_index}]` : "—"}
                            {step.expected_label ? ` ${step.expected_label}` : ""}
                          </span>
                          {step.message && <span className="plan-step-msg">{step.message}</span>}
                        </li>
                      ))}
                    </ul>
                    <LoadMoreFooter
                      hasMore={hasMoreSteps}
                      onLoadMore={loadMoreSteps}
                      rootRef={stepsListRef}
                      label={`Load more (${visibleSteps.length} of ${steps.length})`}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          </>
        )}
      </div>

      {preview ? (
        <ResumePreviewPanel
          title={preview.title}
          sourceKey={preview.sourceKey}
          loadHtml={preview.loadHtml}
          downloadFile={preview.downloadFile}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {jdPreview ? (
        <InspectPanel
          title={`Job description · ${jdPreview.title}`}
          lines={jdPreview.text.split("\n")}
          hasMore={false}
          onLoadMore={() => undefined}
          onCopy={() => navigator.clipboard.writeText(jdPreview.text)}
          onClose={() => setJdPreview(null)}
        />
      ) : null}

      {ui.inspect && inspectView ? (
        <InspectPanel
          title={ui.inspect.title}
          lines={inspectView.lines}
          hasMore={inspectView.hasMore}
          onLoadMore={inspectWindow.loadMore}
          onCopy={inspectView.copy}
          onClose={() => {
            if (activeTabId != null) patchTabUi(activeTabId, { inspect: null });
          }}
        />
      ) : null}

      {showActionBar ? (
        <SidebarActionBar
          fillPhase={progress.phase}
          fillLabel={fillLabel}
          generateLabel={generateLabel}
          recommendLabel={recommendLabel}
          fillDisabled={actionsOff}
          generateDisabled={actionsOff || fillLocked}
          recommendDisabled={actionsOff || fillLocked}
          fillTitle={customLocked ? rememberFirst : fillLabel}
          generateTitle={customLocked ? rememberFirst : fillLocked ? openJobFirst : generateLabel}
          recommendTitle={customLocked ? rememberFirst : fillLocked ? openJobFirst : recommendLabel}
          onFill={() => void startPipeline(mainTab === "custom" ? "custom" : "fill")}
          onGenerate={() =>
            void startCustomWork("generate", {
              continue:
                mainTab === "fill"
                  ? fillCanContinue && attachedJobGenerate?.workKind !== "recommend"
                  : customCanContinue && customTab?.workKind !== "recommend",
            })
          }
          onRecommend={() =>
            void startCustomWork("recommend", {
              continue:
                mainTab === "fill"
                  ? fillCanContinue && attachedJobGenerate?.workKind === "recommend"
                  : customCanContinue && customTab?.workKind === "recommend",
            })
          }
        />
      ) : null}

      <footer className={`status-bar phase-${progress.phase}`}>
        <details
          className="acorn-connection-footer"
          onToggle={(event) => setConnectionOpen((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="acorn-connection-summary">
            <span className={`acorn-settings-dot ${connected ? "on" : "off"}`} aria-hidden="true" />
            <span className="acorn-connection-title">Connection</span>
            <span className="acorn-connection-state">{footerStatus}</span>
          </summary>
          <div className="acorn-connection-body">
            <label className="field">
              <span>Acorn API URL</span>
              <input
                value={apiUrl}
                onChange={(e) => {
                  const value = e.target.value;
                  setApiUrl(value);
                  void setAthensApiUrl(value);
                }}
                placeholder={DEFAULT_ATHENS_API_URL}
              />
            </label>
            <div className={`conn-status ${connected ? "on" : "off"}`}>
              <span className="dot" />
              {connected ? "Socket connected" : session ? "Socket offline" : "Sign in to connect"}
            </div>
          </div>
        </details>
      </footer>
    </div>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none">
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.5 4.5H6.2A1.7 1.7 0 0 0 4.5 6.2v7.6A1.7 1.7 0 0 0 6.2 15.5h2.3M11 6.5 14.5 10 11 13.5M14.5 10H8"
      />
    </svg>
  );
}

function stepStatusLabel(step: RunStepRecord): string {
  if (step.status === "ok") return "verified";
  return step.status;
}

function isValidTree(tree: unknown): tree is DomNode {
  return Boolean(tree && typeof tree === "object" && "tag" in (tree as object));
}

function countNodes(node: DomNode | undefined): number {
  if (!node) return 0;
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}
