import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Badge, Banner, EmptyState, Glyph, HStack, IconButton, Text, VStack } from "sid-ui";
import { IDLE_PIPELINE_PROGRESS, type PipelineProgress } from "@acorn/shared/pipeline-types";
import type { JobAttachment } from "../tab-job-session";
import { LoadMoreFooter } from "./LoadMoreFooter";
import { useShownCount } from "./use-shown-count";
import type { AcornJobGenerateBinding } from "../tab-job-generate-session";
import type { AcornWorkerJob } from "../worker-job";
import { hasAssignedResume } from "./JobResumeActions";
import { WorkerJobCard } from "./WorkerJobCard";

export type { AcornWorkerJob } from "../worker-job";

const JOB_PAGE = 20;

/** True where a group (ready / needs a résumé) begins in the sorted list. */
function groupStartsAt(jobs: AcornWorkerJob[], index: number): boolean {
  return index === 0 || hasAssignedResume(jobs[index]) !== hasAssignedResume(jobs[index - 1]);
}

/** Assigned resumes first; original order preserved within each group. */
function sortJobsAssignedFirst(jobs: AcornWorkerJob[]): AcornWorkerJob[] {
  return [...jobs].sort((a, b) => Number(hasAssignedResume(b)) - Number(hasAssignedResume(a)));
}

type WorkerPoolListProps = {
  jobs: AcornWorkerJob[];
  loading: boolean;
  error: string | null;
  selectedJobId: string | null;
  attachments: Record<string, JobAttachment>;
  pipelines: Record<string, PipelineProgress>;
  generates: Record<string, AcornJobGenerateBinding>;
  openingJobId: string | null;
  markingJobId: string | null;
  listKey: number;
  listActive?: boolean;
  onRefresh: () => void;
  onOpen: (job: AcornWorkerJob) => void;
  onPreviewResume: (job: AcornWorkerJob) => void;
  onMarkApplied: (job: AcornWorkerJob) => void;
  onContinueGenerate?: (job: AcornWorkerJob) => void;
  onRestartGenerate?: (job: AcornWorkerJob) => void;
  onViewJd?: (job: AcornWorkerJob, jd: string) => void;
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
    <VStack as="section" gap={3} className="worker-pool">
      <HStack gap={2} align="center" justify="between">
        <HStack gap={2} align="center">
          <Text as="h2" weight="semibold">
            Worker pool
          </Text>
          <Badge
            variant="neutral"
            label={
              loading
                ? "Loading…"
                : hasMore
                  ? `${visibleJobs.length} of ${orderedJobs.length}`
                  : orderedJobs.length
            }
          />
        </HStack>
        <IconButton
          variant="ghost"
          size="sm"
          icon={<Glyph name="refresh" />}
          label="Refresh jobs"
          tooltip="Refresh"
          isDisabled={loading || Boolean(openingJobId) || Boolean(markingJobId)}
          onClick={onRefresh}
        />
      </HStack>
      {error ? <Banner status="error" title="Couldn’t load jobs" description={error} /> : null}
      {!loading && !error && jobs.length === 0 ? (
        <EmptyState
          isCompact
          title="No jobs in Worker pool"
          description="In Job Search, move roles to Worker pool."
        />
      ) : null}
      <VStack
        as="nav"
        ref={listRef}
        gap={2}
        className="worker-pool-list"
        aria-label="Worker pool jobs"
      >
        {visibleJobs.map((job, index) => (
          <Fragment key={job.id}>
            {groupStartsAt(visibleJobs, index) ? (
              <Text as="h3" type="supporting" weight="semibold" className="acorn-group-heading">
                {hasAssignedResume(job) ? "Ready to fill" : "Needs a résumé"}
              </Text>
            ) : null}
            <WorkerJobCard
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
          </Fragment>
        ))}
        <LoadMoreFooter
          hasMore={hasMore}
          onLoadMore={loadMore}
          rootRef={listRef}
          label={`Load more (${visibleJobs.length} of ${orderedJobs.length})`}
        />
      </VStack>
    </VStack>
  );
}

export const WorkerPoolList = memo(WorkerPoolListInner);
