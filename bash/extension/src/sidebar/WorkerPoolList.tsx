import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IDLE_PIPELINE_PROGRESS, type PipelineProgress } from "../../../shared/pipeline-types";
import { canContinueGenerate, formatGenerateFailure } from "../../../shared/generate-checkpoint";
import { flashOakFace } from "../oak-face/face-flash";
import { resolveRowHold } from "../oak-face/director";
import { useCompletionSmile } from "../oak-face/use-completion-smile";
import type { JobAttachment } from "../tab-job-session";
import { FACE_WINK_MS } from "../oak-face/constants";
import { downloadJobResume, hasAssignedResume, resumeMetaText } from "./JobResumeActions";
import { LoadMoreFooter } from "./LoadMoreFooter";
import { SidebarListCard } from "./SidebarListCard";
import { GenerateRunExtras } from "./GenerateRunExtras";
import { useShownCount } from "./use-shown-count";
import type { OakJobGenerateBinding } from "../tab-job-generate-session";
import type { OakWorkerJob } from "../worker-job";

export type { OakWorkerJob } from "../worker-job";

const JOB_PAGE = 20;

/** Assigned resumes first; original order preserved within each group. */
function sortJobsAssignedFirst(jobs: OakWorkerJob[]): OakWorkerJob[] {
  return [...jobs].sort((a, b) => Number(hasAssignedResume(b)) - Number(hasAssignedResume(a)));
}

type WorkerPoolListProps = {
  jobs: OakWorkerJob[];
  loading: boolean;
  error: string | null;
  selectedJobId: string | null;
  attachments: Record<string, JobAttachment>;
  pipelines: Record<string, PipelineProgress>;
  generates: Record<string, OakJobGenerateBinding>;
  openingJobId: string | null;
  markingJobId: string | null;
  listKey: number;
  listActive?: boolean;
  onRefresh: () => void;
  onOpen: (job: OakWorkerJob) => void;
  onPreviewResume: (job: OakWorkerJob) => void;
  onMarkApplied: (job: OakWorkerJob) => void;
  onContinueGenerate?: (job: OakWorkerJob) => void;
  onRestartGenerate?: (job: OakWorkerJob) => void;
  onViewJd?: (job: OakWorkerJob, jd: string) => void;
};

function WorkerPoolListInner({
  jobs,
  loading,
  error,
  selectedJobId,
  attachments,
  pipelines,
  generates,
  openingJobId,
  markingJobId,
  listKey,
  listActive = true,
  onRefresh,
  onOpen,
  onPreviewResume,
  onMarkApplied,
  onContinueGenerate,
  onRestartGenerate,
  onViewJd,
}: WorkerPoolListProps) {
  const listRef = useRef<HTMLElement>(null);
  const { shownCount, loadMore, ensureCount } = useShownCount(JOB_PAGE, listKey);
  const orderedJobs = useMemo(() => sortJobsAssignedFirst(jobs), [jobs]);
  const visibleJobs = orderedJobs.slice(0, shownCount);
  const hasMore = shownCount < orderedJobs.length;

  useEffect(() => {
    if (!selectedJobId) return;
    const idx = orderedJobs.findIndex((job) => job.id === selectedJobId);
    if (idx >= 0) ensureCount(idx + 1);
  }, [selectedJobId, orderedJobs, ensureCount]);

  useLayoutEffect(() => {
    if (!listActive || !selectedJobId) return;
    const node = listRef.current?.querySelector(`[data-item-id="${CSS.escape(selectedJobId)}"]`);
    if (!(node instanceof HTMLElement)) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [listActive, selectedJobId, shownCount]);

  return (
    <section className="worker-pool">
      <div className="worker-pool-head">
        <div>
          <h3>Jobs</h3>
          <p className="worker-pool-count">
            {loading
              ? "Loading…"
              : hasMore
                ? `${visibleJobs.length} of ${orderedJobs.length} jobs`
                : `${orderedJobs.length} jobs`}
          </p>
        </div>
        <button
          type="button"
          className="tool-card worker-pool-refresh"
          onClick={onRefresh}
          disabled={loading || Boolean(openingJobId) || Boolean(markingJobId)}
        >
          Refresh
        </button>
      </div>
      {error ? <p className="worker-pool-error">{error}</p> : null}
      {!loading && !error && jobs.length === 0 ? (
        <p className="hint">No jobs in Worker pool. In Job Search, move roles to Worker pool.</p>
      ) : null}
      <nav ref={listRef} className="worker-pool-list" aria-label="Worker pool jobs">
        {visibleJobs.map((job) => (
          <WorkerJobCard
            key={job.id}
            job={job}
            selected={selectedJobId === job.id}
            attached={Boolean(attachments[job.id])}
            progress={
              attachments[job.id]
                ? (pipelines[String(attachments[job.id].tabId)] ?? IDLE_PIPELINE_PROGRESS)
                : IDLE_PIPELINE_PROGRESS
            }
            generate={generates[job.id] ?? null}
            opening={openingJobId === job.id}
            marking={markingJobId === job.id}
            onOpen={onOpen}
            onPreviewResume={onPreviewResume}
            onMarkApplied={onMarkApplied}
            onContinueGenerate={onContinueGenerate}
            onRestartGenerate={onRestartGenerate}
            onViewJd={onViewJd}
          />
        ))}
        <LoadMoreFooter
          hasMore={hasMore}
          onLoadMore={loadMore}
          rootRef={listRef}
          label={`Load more (${visibleJobs.length} of ${orderedJobs.length})`}
        />
      </nav>
    </section>
  );
}

function WorkerJobCard({
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
  job: OakWorkerJob;
  selected: boolean;
  attached: boolean;
  progress: PipelineProgress;
  generate: OakJobGenerateBinding | null;
  opening: boolean;
  marking: boolean;
  onOpen: (job: OakWorkerJob) => void;
  onPreviewResume: (job: OakWorkerJob) => void;
  onMarkApplied: (job: OakWorkerJob) => void;
  onContinueGenerate?: (job: OakWorkerJob) => void;
  onRestartGenerate?: (job: OakWorkerJob) => void;
  onViewJd?: (job: OakWorkerJob, jd: string) => void;
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
          flashOakFace({ mode: "wink", ms: FACE_WINK_MS });
          onPreviewResume(job);
        },
      }}
      check={{
        title: "Mark as applied",
        label: `Mark ${job.title} as applied`,
        disabled: opening || marking,
        onClick: () => onMarkApplied(job),
      }}
    >
      <GenerateRunExtras
        progress={generate?.generateProgress ?? null}
        showBar={showBar}
        canContinue={canContinue}
        canRestart={canContinue && Boolean(generate?.checkpoint?.completedSteps.length)}
        canViewJd={canViewJd}
        onContinue={() => onContinueGenerate?.(job)}
        onRestart={() => onRestartGenerate?.(job)}
        onViewJd={() => {
          if (jdText) onViewJd?.(job, jdText);
        }}
      />
    </SidebarListCard>
  );
}

export const WorkerPoolList = memo(WorkerPoolListInner);
