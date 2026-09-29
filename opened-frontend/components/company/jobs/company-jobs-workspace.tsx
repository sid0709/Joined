"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  Badge,
  HStack,
  Icon,
  Stack,
  Tab,
  TabList,
  Text,
  TextInput,
  icons,
  useToast,
} from "@openseat/design-system";
import { StatGrid } from "@/components/stat-card";
import { fetchApplicants, fetchJobs, setJobStatus } from "@/lib/company/api";
import {
  JOB_STATUS_META,
  pipelineTotal,
  type CompanyJob,
  type CompanyJobStatus,
} from "@/lib/company";
import type { Applicant } from "@/lib/company";
import { isBadRequestError, isForbiddenError } from "@/lib/me/client";
import { canPermission, denialReason, type TeamRole } from "@/lib/rbac";
import { CompanyJobDrawer } from "./company-job-drawer";
import { CompanyJobTable, type JobAction } from "./company-job-table";

type Filter = CompanyJobStatus | "all";

const SEARCH_WIDTH = 260;
const FILTERS: Filter[] = ["all", "open", "paused", "draft", "closed"];
const NEXT_STATUS: Partial<Record<JobAction, CompanyJobStatus>> = {
  pause: "paused",
  resume: "open",
  close: "closed",
  publish: "open",
  reopen: "open",
};
const DONE_MESSAGE: Partial<Record<JobAction, string>> = {
  pause: "paused. It is hidden from search until you resume it.",
  resume: "is open again.",
  close: "closed and archived from search. Candidates in progress will be told.",
  publish: "is live.",
  reopen: "reopened and is live again.",
};

function jobStatusErrorMessage(error: unknown): string {
  if (isForbiddenError(error) || isBadRequestError(error)) {
    return error.message || "You cannot change this job's status.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not update job status.";
}

/** The jobs console: stats, status tabs, search, a table, and a detail drawer. */
export function CompanyJobsWorkspace({ actorRole = null }: { actorRole?: TeamRole | null }) {
  const toast = useToast();
  const canEditJobs = canPermission(actorRole, "jobs.edit");
  const canPublishJobs = canPermission(actorRole, "jobs.publish");
  // Einstein AuthorizeJobUpdate: jobs.edit always; jobs.publish when opening to market.
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [closing, setClosing] = useState<CompanyJob | null>(null);
  const [closingBusy, setClosingBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchJobs(), fetchApplicants()])
      .then(([nextJobs, nextPeople]) => {
        if (!active) return;
        setJobs(nextJobs);
        setApplicants(nextPeople);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const needle = query.trim().toLowerCase();
  const searched = jobs.filter(
    (job) =>
      !needle ||
      `${job.title} ${job.team} ${job.department ?? ""} ${job.location}`
        .toLowerCase()
        .includes(needle),
  );
  const shown = filter === "all" ? searched : searched.filter((job) => job.status === filter);
  const live = jobs.filter((job) => job.status === "open");
  const closedCount = jobs.filter((job) => job.status === "closed").length;
  const closingPipeline = closing ? pipelineTotal(closing.pipeline) : 0;

  const applyStatus = (
    job: CompanyJob,
    action: JobAction,
    options?: { closeReason?: string; notifyOnClose?: boolean },
  ) => {
    const next = NEXT_STATUS[action];
    if (!next) return;
    // Einstein PATCH /jobs/:id requires jobs.publish for close and reopen (status open/closed).
    if (next === "open" || next === "closed") {
      if (!canPublishJobs) {
        toast({ body: denialReason(actorRole, "jobs.publish"), type: "error" });
        return;
      }
    } else if (!canEditJobs) {
      toast({ body: denialReason(actorRole, "jobs.edit"), type: "error" });
      return;
    }
    setJobStatus(job.id, next, options)
      .then((saved) => {
        setJobs((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        toast({ body: `${job.title} ${DONE_MESSAGE[action]}` });
      })
      .catch((error: unknown) => toast({ body: jobStatusErrorMessage(error), type: "error" }));
  };

  const act = (job: CompanyJob, action: JobAction) => {
    if (action === "open") return setOpenId(job.id);
    if (action === "close") {
      setClosing(job);
      return;
    }
    applyStatus(job, action);
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          { label: "Live jobs", value: String(live.length), hint: `${jobs.length} in total` },
          {
            label: "Candidates",
            value: String(live.reduce((sum, job) => sum + pipelineTotal(job.pipeline), 0)),
            hint: "Across live jobs",
          },
          {
            label: "Views",
            value: jobs.reduce((sum, job) => sum + job.views, 0).toLocaleString(),
            hint: "Since posting",
          },
          {
            label: "Archived",
            value: String(closedCount),
            hint: "Closed jobs stay here to reopen",
          },
        ]}
      />

      <HStack hAlign="between" vAlign="end" gap={3} wrap="wrap">
        <TabList value={filter} onChange={(value) => setFilter(value as Filter)} overflow="scroll">
          {FILTERS.map((value) => (
            <Tab
              key={value}
              value={value}
              label={
                value === "all"
                  ? "All"
                  : value === "closed"
                    ? "Archived"
                    : JOB_STATUS_META[value].label
              }
              endContent={
                <Badge
                  label={String(
                    value === "all"
                      ? searched.length
                      : searched.filter((job) => job.status === value).length,
                  )}
                  variant="neutral"
                />
              }
            />
          ))}
        </TabList>
        <TextInput
          label="Search jobs"
          isLabelHidden
          placeholder="Search title, team, or city"
          startIcon={<Icon icon={icons.search} />}
          value={query}
          onChange={setQuery}
          hasClear
          width={SEARCH_WIDTH}
        />
      </HStack>

      {filter === "closed" ? (
        <Text type="supporting" color="secondary">
          Closed jobs are archived from search. Reopen one to put it live again; in-progress
          candidates keep their history.
        </Text>
      ) : null}

      <CompanyJobTable
        jobs={shown}
        onAction={act}
        canEdit={canEditJobs}
        canPublish={canPublishJobs}
      />
      <CompanyJobDrawer
        job={jobs.find((job) => job.id === openId) ?? null}
        applicants={applicants}
        onClose={() => setOpenId(null)}
        onAction={act}
        canEdit={canEditJobs}
        canPublish={canPublishJobs}
        onPipelineSaved={(jobId, pipeline, templates) => {
          setJobs((current) =>
            current.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    customStages: pipeline.stages,
                    feedbackGate: pipeline.feedbackGate,
                    scorecardTemplate: pipeline.scorecardTemplate ?? undefined,
                    interviewGuide: pipeline.interviewGuide ?? undefined,
                    offerTemplates: templates ?? job.offerTemplates,
                  }
                : job,
            ),
          );
        }}
      />

      <AlertDialog
        isOpen={closing != null}
        onOpenChange={(open) => {
          if (!open) setClosing(null);
        }}
        title={`Close and archive “${closing?.title ?? ""}”?`}
        description={
          closingPipeline > 0
            ? `${closingPipeline} candidate${closingPipeline === 1 ? "" : "s"} are still in the pipeline. They’ll be told the role closed. You can reopen later from Archived.`
            : "The posting leaves search right away. You can reopen it later from Archived."
        }
        actionLabel="Close job"
        actionVariant="destructive"
        isActionLoading={closingBusy}
        onAction={() => {
          if (!closing) return;
          setClosingBusy(true);
          const job = closing;
          if (!canPublishJobs) {
            toast({ body: denialReason(actorRole, "jobs.publish"), type: "error" });
            setClosingBusy(false);
            return;
          }
          setJobStatus(job.id, "closed", { notifyOnClose: true })
            .then((saved) => {
              setJobs((current) => current.map((item) => (item.id === saved.id ? saved : item)));
              toast({ body: `${job.title} ${DONE_MESSAGE.close}` });
              setClosing(null);
            })
            .catch((error: unknown) => toast({ body: jobStatusErrorMessage(error), type: "error" }))
            .finally(() => setClosingBusy(false));
        }}
      />
    </Stack>
  );
}
