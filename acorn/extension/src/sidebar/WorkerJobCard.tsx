import { useState } from "react";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import { canContinueGenerate, formatGenerateFailure } from "@acorn/shared/generate-checkpoint";
import { flashAcornFace } from "../acorn-face/face-flash";
import { resolveRowHold } from "../acorn-face/director";
import { useCompletionSmile } from "../acorn-face/use-completion-smile";
import { FACE_WINK_MS } from "../acorn-face/constants";
import { downloadJobResume, hasAssignedResume, resumeMetaText } from "./JobResumeActions";
import { SidebarListCard } from "./SidebarListCard";
import { runExtras } from "./run-extras";
import type { AcornJobGenerateBinding } from "../tab-job-generate-session";
import type { AcornWorkerJob } from "../worker-job";

export function WorkerJobCard({
  job,
  selected,
  attached,
  progress,
  generate,
  opening,
  marking,
  onOpen,
  onPreviewResume,
  onMarkApplied,
  onContinueGenerate,
  onRestartGenerate,
  onViewJd,
}: {
  job: AcornWorkerJob;
  selected: boolean;
  attached: boolean;
  progress: PipelineProgress;
  generate: AcornJobGenerateBinding | null;
  opening: boolean;
  marking: boolean;
  onOpen: (job: AcornWorkerJob) => void;
  onPreviewResume: (job: AcornWorkerJob) => void;
  onMarkApplied: (job: AcornWorkerJob) => void;
  onContinueGenerate?: (job: AcornWorkerJob) => void;
  onRestartGenerate?: (job: AcornWorkerJob) => void;
  onViewJd?: (job: AcornWorkerJob, jd: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [winkToken, setWinkToken] = useState(0);
  const generating =
    generate?.generateStatus === "queued" || generate?.generateStatus === "running";
  const localResume = Boolean(generate?.generationId);
  const ready = hasAssignedResume(job) || localResume;
  const canContinue = canContinueGenerate(generate?.generateStatus, generate?.checkpoint);
  const jdText =
    generate?.jobDescription || generate?.checkpoint?.outputs.jobDescription || job.jobDescription;
  const canViewJd = Boolean(String(jdText || "").trim());
  const showBar = generating || canContinue;
  const canOpen = Boolean(job.applyUrl) && !opening && !marking;
  const actionsOff = opening || marking || busy || generating;
  const openTitle = !job.applyUrl
    ? "No apply URL"
    : attached
      ? "Show this job’s tab"
      : "Open apply page in a new tab";
  const failure = formatGenerateFailure({
    status: generate?.generateStatus,
    workKind: generate?.workKind,
    error: generate?.generateError,
    checkpoint: generate?.checkpoint,
  });
  const resumeText = generating
    ? generate?.generateProgress?.label || "Generating…"
    : failure
      ? failure
      : localResume
        ? "Generated"
        : resumeMetaText(job);

  const hold = resolveRowHold({
    fillPhase: progress.phase,
    resumeSkipped: progress.resumeUpload?.status === "skipped",
    generateStatus: generate?.generateStatus,
    generateLabel: generate?.generateProgress?.label ?? null,
    hasResume: ready,
    blocked: !job.applyUrl,
    recommendWarning: Boolean(job.recommendWarning),
    selected,
    opening,
    marking,
    downloading: busy,
  });
  const faceMode = useCompletionSmile({
    hold,
    fillPhase: progress.phase,
    generateStatus: generate?.generateStatus,
    winkToken,
  });

  const download = async () => {
    if (!ready || actionsOff) return;
    setBusy(true);
    try {
      await downloadJobResume(job);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidebarListCard
      itemId={job.id}
      selected={selected}
      attached={attached}
      blocked={!canOpen}
      marking={marking}
      faceMode={faceMode}
      logoUrl={job.companyLogoUrl}
      logoFallback={job.company}
      title={job.title}
      subtitle={job.company}
      resumeText={resumeText}
      resumeReady={ready && !generating && !canContinue}
      resumeFailed={Boolean(failure) && !generating}
      open={{
        title: openTitle,
        label: !job.applyUrl
          ? `${job.title}. No apply URL`
          : attached
            ? `Show tab for ${job.title}`
            : `Open apply page for ${job.title}`,
        disabled: !canOpen,
        current: selected,
        onClick: () => {
          if (canOpen) onOpen(job);
        },
      }}
      download={{
        title: busy
          ? "Downloading…"
          : ready
            ? job.generatedResume || localResume
              ? "Download generated résumé"
              : "Download résumé"
            : "No résumé assigned",
        label: busy
          ? "Downloading résumé"
          : ready
            ? `Download résumé for ${job.title}`
            : `No résumé assigned for ${job.title}`,
        disabled: actionsOff || !ready,
        onClick: () => void download(),
      }}
      preview={{
        title: ready ? "Preview résumé" : "No résumé assigned",
        label: ready ? `Preview résumé for ${job.title}` : `No résumé assigned for ${job.title}`,
        disabled: opening || marking || generating || !ready,
        onClick: () => {
          setWinkToken((n) => n + 1);
          flashAcornFace({ mode: "wink", ms: FACE_WINK_MS });
          onPreviewResume(job);
        },
      }}
      check={{
        title: "Mark as applied",
        label: `Mark ${job.title} as applied`,
        disabled: opening || marking,
        onClick: () => onMarkApplied(job),
      }}
      {...runExtras({
        progress: generate?.generateProgress ?? null,
        showBar: showBar,
        canContinue: canContinue,
        canRestart: canContinue && Boolean(generate?.checkpoint?.completedSteps.length),
        canViewJd: canViewJd,
        onContinue: () => onContinueGenerate?.(job),
        onRestart: () => onRestartGenerate?.(job),
        onViewJd: () => {
          if (jdText) onViewJd?.(job, jdText);
        },
      })}
    />
  );
}
