import { useCallback, useEffect, useState } from "react";
import type { AcornStoredSession } from "../auth/acorn-auth";
import { MSG } from "../types";
import { pushAcornNotice } from "./acorn-notice";
import { sendMessage } from "./runtime";
import type { useTabSession } from "./use-tab-session";
import type { AcornWorkerJob } from "./WorkerPoolList";

type Attachments = ReturnType<typeof useTabSession>["attachments"];

/** The Fill tab's Worker pool jobs: loading them, opening one, and marking one applied. */
export function useWorkerJobs({
  session,
  activeTabId,
  attachments,
}: {
  session: AcornStoredSession | null;
  activeTabId: number | null;
  attachments: Attachments;
}) {
  const [workerJobs, setWorkerJobs] = useState<AcornWorkerJob[]>([]);
  const [workerJobsLoading, setWorkerJobsLoading] = useState(false);
  const [workerJobsError, setWorkerJobsError] = useState<string | null>(null);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  const [markingJobId, setMarkingJobId] = useState<string | null>(null);
  const [jobsListKey, setJobsListKey] = useState(0);

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

  return {
    workerJobs,
    workerJobsLoading,
    workerJobsError,
    openingJobId,
    markingJobId,
    jobsListKey,
    fetchWorkerJobs,
    openWorkerJob,
    markJobApplied,
  };
}
