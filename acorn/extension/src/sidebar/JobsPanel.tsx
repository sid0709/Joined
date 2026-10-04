import type { ReactNode } from "react";
import type { AcornMainTab } from "./SidebarNav";
import { WorkerPoolList } from "./WorkerPoolList";
import type {
  JdPreview,
  ResumePreview,
  TabSession,
  TabWork,
  WorkerJobs,
} from "./sidebar-panel-types";

interface Props {
  mainTab: AcornMainTab;
  nowCard: ReactNode;
  workerJobs: WorkerJobs["workerJobs"];
  workerJobsLoading: WorkerJobs["workerJobsLoading"];
  workerJobsError: WorkerJobs["workerJobsError"];
  openingJobId: WorkerJobs["openingJobId"];
  markingJobId: WorkerJobs["markingJobId"];
  jobsListKey: WorkerJobs["jobsListKey"];
  fetchWorkerJobs: WorkerJobs["fetchWorkerJobs"];
  openWorkerJob: WorkerJobs["openWorkerJob"];
  markJobApplied: WorkerJobs["markJobApplied"];
  tabJob: TabSession["tabJob"];
  attachments: TabSession["attachments"];
  pipelines: TabSession["pipelines"];
  jobGenerates: TabSession["jobGenerates"];
  openJobResumePreview: ResumePreview["openJobResumePreview"];
  startJobWork: TabWork["startJobWork"];
  setJdPreview: (preview: JdPreview | null) => void;
}

/** The Jobs tab: the Now card and the Worker pool list. */
export function JobsPanel({
  mainTab,
  nowCard,
  workerJobs,
  workerJobsLoading,
  workerJobsError,
  openingJobId,
  markingJobId,
  jobsListKey,
  fetchWorkerJobs,
  openWorkerJob,
  markJobApplied,
  tabJob,
  attachments,
  pipelines,
  jobGenerates,
  openJobResumePreview,
  startJobWork,
  setJdPreview,
}: Props) {
  return (
    <section
      id="acorn-panel-fill"
      className="acorn-panel"
      aria-label="Jobs"
      hidden={mainTab !== "fill"}
    >
      {nowCard}
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
    </section>
  );
}
