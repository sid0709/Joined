import { formatDuration, formatUsd } from "@acorn/shared/ai-usage";
import { applyApplicantIdentityToActions } from "@acorn/shared/plan-runner/applicant-identity";
import { runActionPlan } from "@acorn/shared/plan-runner/orchestrator";
import type { ActionPlan, PlanStepPayload, RunStepRecord } from "@acorn/shared/plan-runner/types";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import { formatAnalyzeTrees } from "@acorn/shared/tree-export";
import { sendPlanStepToTab, sendTabMessage } from "../tab-messaging";
import { getTabJob } from "../tab-job-session";
import { customTabHasResume, getCustomTab } from "../tab-custom-session";
import { DEFAULT_ACORN_API_URL } from "../auth/acorn-auth";
import { MSG, type DomTreePayload, type PipelineSource } from "../types";
import { requestAiAnalyze } from "./api/analyze";
import { fetchRuntimeFile } from "./api/job-files";
import { keepResumeIfSameSite, loadFillResume } from "./fill-resume";
import { buildResumeUploadProgress } from "./resume-upload-status";
import {
  addPipelineUsage,
  beginPipelineUsageTracking,
  endPipelineUsageTracking,
} from "./usage-tracker";
import { fetchDomFromTab } from "./fetch-dom";
import { autoPauseDecision, countDomNodes, shortLabel } from "./run-pipeline-helpers";

export type PipelineEmit = (progress: PipelineProgress) => void;

export interface RunPipelineArgs {
  /** Pinned at Fill click. DOM fetch and every plan step target this tab, even if the user focuses another. */
  tabId: number;
  preferredFrameId?: number | null;
  aiServerUrl?: string;
  /** Worker Pool Fill (default) or Custom remembered-tab Fill. */
  source?: PipelineSource;
  /** Emit DOM tree to the backend (optional socket emit callback). */
  emitDomTree?: (payload: DomTreePayload) => void;
  /** Broadcast progress to the Chrome side panel + backend. */
  onProgress: PipelineEmit;
}

export async function runFabPipeline(args: RunPipelineArgs): Promise<void> {
  const {
    tabId,
    preferredFrameId = null,
    aiServerUrl = DEFAULT_ACORN_API_URL,
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
