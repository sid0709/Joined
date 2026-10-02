import { formatDuration, formatUsd } from "@acorn/shared/ai-usage";
import { applyApplicantIdentityToActions } from "@acorn/shared/plan-runner/applicant-identity";
import { runActionPlan } from "@acorn/shared/plan-runner/orchestrator";
import type {
  ActionPlan,
  PauseRequest,
  PlanStepPayload,
  RunStepRecord,
} from "@acorn/shared/plan-runner/types";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import { formatAnalyzeTrees } from "@acorn/shared/tree-export";
import { sendPlanStepToTab, sendTabMessage } from "../tab-messaging";
import { getTabJob } from "../tab-job-session";
import { customTabHasResume, getCustomTab } from "../tab-custom-session";
import { DEFAULT_JOINED_API_URL } from "../auth/acorn-auth";
import { MSG, type DomNode, type DomTreePayload, type PipelineSource } from "../types";
import { fetchRuntimeFile, requestAiAnalyze } from "./ai-client";
import { keepResumeIfSameSite, loadFillResume } from "./fill-resume";
import { buildResumeUploadProgress } from "./resume-upload-status";
import {
  addPipelineUsage,
  beginPipelineUsageTracking,
  endPipelineUsageTracking,
} from "./usage-tracker";

export type PipelineEmit = (progress: PipelineProgress) => void;

export interface RunPipelineArgs {
  /** Pinned at Fill click. DOM fetch and every plan step target this tab, even if the user focuses another. */
  tabId: number;
  preferredFrameId?: number | null;
  aiServerUrl?: string;
  /** Worker Pool Fill (default) or Custom remembered-tab Fill. */
  source?: PipelineSource;
  /** Emit DOM tree to backend for UI board (optional socket emit callback). */
  emitDomTree?: (payload: DomTreePayload) => void;
  /** Broadcast progress to the Chrome side panel + backend. */
  onProgress: PipelineEmit;
}

function shortLabel(expectedLabel: string | null | undefined, action: string): string {
  const label = (expectedLabel || "").trim();
  if (!label) return action;
  return label.length > 36 ? `${label.slice(0, 33)}…` : label;
}

const DOM_FETCH_DETAIL_FRAMES = 8;

type DomFrameAttempt = {
  frameId: number;
  parentFrameId: number | null;
  host: string;
  outcome: "ok" | "skipped" | "no-tree" | "error";
  formScore: number | null;
  error: string | null;
};

function frameHost(url?: string): string {
  try {
    return url ? new URL(url).host : "?";
  } catch {
    return "?";
  }
}

function formatDomFetchFailure(tabId: number, attempts: DomFrameAttempt[]): string {
  const lines = [
    `Could not fetch DOM from any frame (tab ${tabId}, ${attempts.length} frame${
      attempts.length === 1 ? "" : "s"
    }).`,
  ];
  const shown = attempts.slice(0, DOM_FETCH_DETAIL_FRAMES);
  for (const row of shown) {
    const score = row.formScore == null ? "" : ` score=${row.formScore}`;
    const err = row.error ? ` — ${row.error}` : "";
    const parent = row.parentFrameId == null ? "" : ` parent=${row.parentFrameId}`;
    lines.push(`frame ${row.frameId}${parent} ${row.host}: ${row.outcome}${score}${err}`);
  }
  if (attempts.length > shown.length) {
    lines.push(`… ${attempts.length - shown.length} more frames`);
  }
  const unreachable = attempts.every(
    (row) =>
      row.outcome === "error" &&
      /could not establish connection|receiving end does not exist/i.test(row.error || ""),
  );
  lines.push(
    unreachable
      ? "No content script answered. Reload the Acorn extension, then refresh this page."
      : "Reload the Acorn extension and refresh the page.",
  );
  return lines.join("\n");
}

/**
 * Unattended pause policy for FAB pipeline:
 * - errors → always skip (Continue/Abort stay available for UI board)
 * - planned pause → continue so autofill can run when a value is present
 */
async function autoPauseDecision(request: PauseRequest) {
  if (request.kind === "error") return "skip" as const;
  return "continue" as const;
}

export async function fetchDomFromTab(
  tabId: number,
  preferredFrameId?: number | null,
): Promise<DomTreePayload> {
  const tried = new Set<number>();

  const attempt = async (frameId?: number) => {
    if (frameId != null) {
      if (tried.has(frameId)) return null;
      tried.add(frameId);
    }
    return sendTabMessage<
      DomTreePayload & { error?: string; skipped?: boolean; formScore?: number }
    >(tabId, { type: MSG.FETCH_DOM }, frameId);
  };

  type Candidate = DomTreePayload & { formScore: number };
  const candidates: Candidate[] = [];
  const attempts: DomFrameAttempt[] = [];

  const consider = (
    res: (DomTreePayload & { error?: string; skipped?: boolean; formScore?: number }) | null,
    frameId: number,
    parentFrameId: number | null,
    listedUrl?: string,
  ) => {
    const host = frameHost(res?.url || listedUrl);
    const formScore = typeof res?.formScore === "number" ? res.formScore : null;
    const error = res?.error ? String(res.error) : null;
    if (res?.tree && !res.error) {
      attempts.push({
        frameId,
        parentFrameId,
        host,
        outcome: "ok",
        formScore: typeof res.formScore === "number" ? res.formScore : 0,
        error: null,
      });
      candidates.push({
        ...res,
        tabId,
        frameId,
        formScore: typeof res.formScore === "number" ? res.formScore : 0,
      });
      return;
    }
    attempts.push({
      frameId,
      parentFrameId,
      host,
      outcome: res?.skipped ? "skipped" : error ? "error" : "no-tree",
      formScore,
      error,
    });
  };

  let frameList: Array<{ frameId: number; url?: string; parentFrameId?: number }> = [
    { frameId: 0 },
  ];
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (frames?.length) {
      frameList = frames.map((f) => ({
        frameId: f.frameId,
        url: f.url,
        parentFrameId: f.parentFrameId,
      }));
    }
  } catch {
    // restricted pages — fall back to main frame only
  }

  if (preferredFrameId != null) {
    consider(await attempt(preferredFrameId), preferredFrameId, null);
  }
  for (const frame of frameList) {
    const res = await attempt(frame.frameId);
    if (res == null) continue;
    consider(res, frame.frameId, frame.parentFrameId ?? null, frame.url);
  }

  if (!candidates.length) {
    throw new Error(formatDomFetchFailure(tabId, attempts));
  }

  candidates.sort((a, b) => {
    if (b.formScore !== a.formScore) return b.formScore - a.formScore;
    if (a.frameId === preferredFrameId) return -1;
    if (b.frameId === preferredFrameId) return 1;
    // Prefer nested frames over shell when scores tie.
    return (b.frameId ?? 0) - (a.frameId ?? 0);
  });

  const picked = candidates[0];
  return picked;
}

export async function runFabPipeline(args: RunPipelineArgs): Promise<void> {
  const {
    tabId,
    preferredFrameId = null,
    aiServerUrl = DEFAULT_JOINED_API_URL,
    source = "fill",
    emitDomTree,
    onProgress,
  } = args;

  const startedAt = Date.now();
  beginPipelineUsageTracking(tabId);

  let treeSnapshot: PipelineProgress["tree"];
  let planSnapshot: ActionPlan | undefined;
  let stepsSnapshot: RunStepRecord[] | undefined;

  const emit: PipelineEmit = (progress) => {
    if (progress.tree) treeSnapshot = progress.tree;
    if (progress.plan) planSnapshot = progress.plan;
    if (progress.steps) stepsSnapshot = progress.steps;
    onProgress(progress);
  };

  const finishMeta = () => {
    const durationMs = Date.now() - startedAt;
    const usage = endPipelineUsageTracking(tabId);
    return { durationMs, usage };
  };

  try {
    emit({ phase: "fetching", message: "Fetching DOM…" });

    const customTab = await getCustomTab(tabId);
    if (source === "custom" && !customTab) {
      throw new Error("Remember this tab before Fill");
    }
    const tabJob = source === "custom" ? null : await getTabJob(tabId);
    const usingForcedCustom =
      source !== "custom" && customTab != null && customTabHasResume(customTab);
    const resumeSource: PipelineSource =
      source === "custom" || usingForcedCustom ? "custom" : "fill";
    const [treePayload, resumeLoad, runtimeFile] = await Promise.all([
      fetchDomFromTab(tabId, preferredFrameId),
      loadFillResume({
        source: resumeSource,
        tabJob,
        customTab,
        customGenerationId: customTab?.generationId ?? null,
        apiUrl: aiServerUrl,
      }),
      fetchRuntimeFile(aiServerUrl).catch(() => null),
    ]);
    const boundResume =
      resumeSource === "custom"
        ? { file: resumeLoad.file, skipReason: resumeLoad.skipReason }
        : keepResumeIfSameSite(resumeLoad.file, tabJob, treePayload.url, resumeLoad.skipReason);
    const resumeFile = boundResume.file;
    const usingLibrary = resumeSource === "custom" && customTab?.resumeMode === "recommend";
    const recommendedResume =
      resumeSource === "custom" ? (usingLibrary ? resumeFile : null) : resumeFile;
    const customResume = resumeSource === "custom" && !usingLibrary ? resumeFile : null;
    const resumeFileKind = resumeSource === "custom" && !usingLibrary ? "custom" : "library";
    const resumeSkipReason = boundResume.skipReason;
    const boundResumeStack =
      resumeSource === "custom"
        ? resumeFile?.label ||
          (usingLibrary
            ? customTab?.recommendedResumeStack
            : customTab?.generationId
              ? "Generated"
              : null)
        : (tabJob?.resumeStack ?? null);
    emitDomTree?.(treePayload);
    treeSnapshot = {
      url: treePayload.url,
      title: treePayload.title,
      tree: treePayload.tree,
      fetchedAt: treePayload.fetchedAt,
    };

    const resumeUpload = () =>
      buildResumeUploadProgress({
        recommendedResume: resumeFile,
        resumeStack: boundResumeStack,
        skipReason: resumeSkipReason,
        steps: stepsSnapshot,
      });

    const nodeCount = countDomNodes(treePayload.tree);
    emit({
      phase: "analyzing",
      message: resumeFile
        ? `Analyzing ${nodeCount} nodes · resume ${resumeFile.label || resumeFile.name}`
        : source === "custom"
          ? usingLibrary && customTab?.recommendedResumeId
            ? `Analyzing ${nodeCount} nodes · Library file unavailable`
            : customTab?.generationId
              ? `Analyzing ${nodeCount} nodes · generated file unavailable`
              : `Analyzing ${nodeCount} nodes…`
          : tabJob?.resumeStack
            ? `Analyzing ${nodeCount} nodes · ${tabJob.resumeStack} file unavailable`
            : `Analyzing ${nodeCount} nodes…`,
      tree: treeSnapshot,
      resumeUpload: resumeUpload(),
    });

    const { pureTree } = formatAnalyzeTrees(treePayload.tree);

    const analyze = await requestAiAnalyze(
      {
        pureTree,
        page: {
          title: treePayload.title || "Untitled",
          url: treePayload.url,
          fetchedAt: treePayload.fetchedAt,
          job:
            source === "custom"
              ? null
              : tabJob
                ? {
                    id: tabJob.jobId,
                    title: tabJob.title,
                    company: tabJob.company,
                  }
                : null,
          customGenerationId:
            source === "custom" && !usingLibrary ? (customTab?.generationId ?? null) : null,
          customLibraryResumeId:
            source === "custom" && usingLibrary ? (customTab?.recommendedResumeId ?? null) : null,
          customRemembered: source === "custom",
          recommendedResumeAvailable: Boolean(resumeFile),
          recommendedResumeStack:
            resumeFile?.label ||
            (source === "custom"
              ? usingLibrary
                ? customTab?.recommendedResumeStack
                : customTab?.generationId
                  ? "Generated"
                  : null
              : tabJob?.resumeStack) ||
            null,
        },
      },
      aiServerUrl,
    );
    addPipelineUsage(tabId, analyze.usage);

    const plan = analyze.plan as ActionPlan;
    applyApplicantIdentityToActions(plan.actions);
    planSnapshot = plan;
    const stepTotal = plan.actions?.length ?? 0;

    emit({
      phase: "running",
      message: stepTotal ? `Running 0/${stepTotal}…` : "Running…",
      stepIndex: 0,
      stepTotal,
      plan,
      resumeUpload: resumeUpload(),
    });

    const frameId = treePayload.frameId ?? preferredFrameId ?? null;

    const report = await runActionPlan({
      plan,
      runtimeFile,
      recommendedResume,
      customResume,
      resumeFileKind,
      executeStep: async (step: PlanStepPayload) => {
        const res = await sendPlanStepToTab(tabId, step, frameId);
        const details = res.details ?? {};
        return {
          ok: Boolean(res.ok),
          verified: res.verified,
          acted: res.acted,
          alreadyFilled: Boolean(res.alreadyFilled),
          error: res.error,
          details: {
            nodeId: typeof details.nodeId === "number" ? details.nodeId : undefined,
            matchedLabel:
              typeof details.matchedLabel === "string" ? details.matchedLabel : undefined,
            matchedRole: typeof details.matchedRole === "string" ? details.matchedRole : undefined,
            valueAfter: typeof details.valueAfter === "string" ? details.valueAfter : undefined,
          },
        };
      },
      hooks: {
        onSteps: (steps) => {
          const running = steps.find((s) => s.status === "running" || s.status === "paused");
          const doneCount = steps.filter((s) =>
            ["ok", "skipped", "blocked", "failed", "aborted"].includes(s.status),
          ).length;
          const current = running ?? steps[Math.min(doneCount, steps.length - 1)];
          const idx = current ? current.index + 1 : doneCount;
          emit({
            phase: "running",
            message: `Running ${Math.min(idx, stepTotal)}/${stepTotal}…`,
            stepIndex: current?.index,
            stepTotal,
            stepLabel: current ? shortLabel(current.expected_label, current.action) : undefined,
            steps,
            resumeUpload: buildResumeUploadProgress({
              recommendedResume: resumeFile,
              resumeStack: boundResumeStack,
              skipReason: resumeSkipReason,
              steps,
            }),
          });
        },
        onPause: async (request) => {
          emit({
            phase: "running",
            message:
              request.kind === "error"
                ? `Skipping: ${shortLabel(request.expected_label, request.action)}`
                : `Review: ${shortLabel(request.expected_label, request.action)}`,
            stepIndex: request.index,
            stepTotal,
            stepLabel: shortLabel(request.expected_label, request.action),
            resumeUpload: resumeUpload(),
          });
          return autoPauseDecision(request);
        },
      },
    });

    if (!report.aborted) {
      await sendTabMessage<{
        ok?: boolean;
        found?: number;
        filled?: number;
        raceLike?: number;
        error?: string;
        skipped?: boolean;
      }>(tabId, { type: MSG.FILL_LEFTOVER_COMBOS }, frameId ?? undefined, 120000);
    }

    const { durationMs, usage } = finishMeta();
    const timeLabel = formatDuration(durationMs);
    const costLabel = formatUsd(usage?.costUsd);

    const doneResume = buildResumeUploadProgress({
      recommendedResume: resumeFile,
      resumeStack: boundResumeStack,
      skipReason: resumeSkipReason,
      steps: report.steps,
    });

    if (report.aborted) {
      emit({
        phase: "error",
        message: `Aborted · ${timeLabel} · ${costLabel}`,
        error: "Plan run aborted",
        stepTotal,
        durationMs,
        usage,
        tree: treeSnapshot,
        plan: planSnapshot,
        steps: report.steps,
        resumeUpload: doneResume,
      });
      return;
    }

    const { summary } = report;
    const resultLabel = report.ok
      ? `${summary.ok} ok`
      : `${summary.ok} ok, ${summary.skipped} skipped`;

    emit({
      phase: "done",
      message: `Done · ${resultLabel} · ${timeLabel} · ${costLabel}`,
      stepTotal,
      durationMs,
      usage,
      tree: treeSnapshot,
      plan: planSnapshot,
      steps: report.steps,
      resumeUpload: doneResume,
    });
  } catch (err) {
    const { durationMs, usage } = finishMeta();
    const error = err instanceof Error ? err.message : String(err);
    emit({
      phase: "error",
      message: `Failed · ${formatDuration(durationMs)} · ${formatUsd(usage?.costUsd)}`,
      error,
      durationMs,
      usage,
      tree: treeSnapshot,
      plan: planSnapshot,
      steps: stepsSnapshot,
    });
  }
}

function countDomNodes(node: DomNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countDomNodes(child), 0);
}
