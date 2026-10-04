import { canContinueGenerate } from "@acorn/shared/generate-checkpoint";
import { isFillPhaseBusy, type PipelineProgress } from "@acorn/shared/pipeline-types";
import type { AcornMainTab } from "./SidebarNav";
import type { useTabSession } from "./use-tab-session";
import type { AcornWorkerJob } from "./WorkerPoolList";

type TabSession = ReturnType<typeof useTabSession>;

/** Whether the active tab's Custom tab or attached Fill job has Generate / Recommend in flight. */
export function isGenerateBusy(
  customTab: TabSession["customTab"],
  tabJob: TabSession["tabJob"],
  jobGenerates: TabSession["jobGenerates"],
): boolean {
  return (
    customTab?.generateStatus === "queued" ||
    customTab?.generateStatus === "running" ||
    (tabJob != null &&
      (jobGenerates[tabJob.jobId]?.generateStatus === "queued" ||
        jobGenerates[tabJob.jobId]?.generateStatus === "running"))
  );
}

/** Whether any tab is filling, generating, or recommending. */
export function isAnyTabWorking(
  pipelines: TabSession["pipelines"],
  customList: TabSession["customList"],
  jobGenerates: TabSession["jobGenerates"],
): boolean {
  return (
    Object.values(pipelines).some((row) => isFillPhaseBusy(row.phase)) ||
    customList.some((tab) => tab.generateStatus === "queued" || tab.generateStatus === "running") ||
    Object.values(jobGenerates).some(
      (row) => row.generateStatus === "queued" || row.generateStatus === "running",
    )
  );
}

/** Labels and Continue state for the sticky Generate / Fill page / Recommend bar. */
export function actionBarState({
  mainTab,
  tabJob,
  customTab,
  jobGenerates,
  workerJobs,
  progress,
  fillBusy,
  generateBusy,
}: {
  mainTab: AcornMainTab;
  tabJob: TabSession["tabJob"];
  customTab: TabSession["customTab"];
  jobGenerates: TabSession["jobGenerates"];
  workerJobs: AcornWorkerJob[];
  progress: PipelineProgress;
  fillBusy: boolean;
  generateBusy: boolean;
}) {
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

  return {
    attachedJobGenerate,
    fillCanContinue,
    customCanContinue,
    generateLabel,
    recommendLabel,
    fillLabel,
  };
}
