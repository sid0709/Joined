import { assertCompleteJob, isJobFieldValid } from "../../api/jobValidation";
import { createScrapeRunStats, mergeScrapeRunStats } from "../../api/scrapeRunStats";
import { isFound } from "../../routineKit/html.js";

import { toJobPayload } from "./jobPayload";
import {
  addRecentJob,
  fieldStatus,
  isActiveQueueRun,
  pendingFields,
  recordFieldHit,
} from "./runState";

export const EMPTY_QUEUE = { queued: 0, saving: 0 };

export const newRunId = () =>
  globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Apply a scrapeQueue snapshot only when it belongs to this run. */
export function applyActiveQueueSnapshot(runId, state) {
  if (!isActiveQueueRun(runId, state?.runId)) return null;
  return {
    counts: state.counts || EMPTY_QUEUE,
    summary: state.summary || null,
  };
}

/** Score one declared field. A throw becomes an invalid hit plus an error. */
export function readDeclaredField(path, record, found, routine) {
  try {
    const valid = isJobFieldValid(toJobPayload(record, routine), path, routine);
    return { path, found: Boolean(found), valid, error: null };
  } catch (error) {
    return {
      path,
      found: Boolean(found),
      valid: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Start → field reads → enqueue, without React. The Run hook and the full-run
 * test share this so a matching scrapeQueue ack updates panel counts.
 */
export function createRoutineRunSession({ send } = {}) {
  let runId = null;
  let stats = createScrapeRunStats();
  let queueCounts = { ...EMPTY_QUEUE };
  let fieldHits = {};
  let fieldStates = {};
  let recentJobs = [];
  let extractError = null;
  const enqueued = [];

  const applySnapshot = (state) => {
    const applied = applyActiveQueueSnapshot(runId, state);
    if (!applied) return false;
    queueCounts = applied.counts;
    if (applied.summary) stats = mergeScrapeRunStats(stats, applied.summary);
    return true;
  };

  return {
    get snapshot() {
      return {
        runId,
        stats,
        queueCounts,
        fieldHits,
        fieldStates,
        recentJobs,
        extractError,
      };
    },
    get enqueued() {
      return enqueued;
    },
    async start(routine) {
      runId = newRunId();
      stats = createScrapeRunStats();
      queueCounts = { ...EMPTY_QUEUE };
      fieldHits = {};
      fieldStates = pendingFields(routine);
      recentJobs = [];
      extractError = null;
      const response = await send?.({
        action: "scrapeQueue:clear",
        payload: { beginRunId: runId },
      });
      applySnapshot(response?.state);
      return runId;
    },
    applyQueueState(state) {
      return applySnapshot(state);
    },
    recordField(path, record, found, routine) {
      const result = readDeclaredField(path, record, found, routine);
      fieldStates = { ...fieldStates, [path]: fieldStatus(result.found, result.valid) };
      fieldHits = recordFieldHit(fieldHits, path, result.found);
      if (result.error) extractError = result.error.message;
      return result;
    },
    recordFields(record, routine) {
      const declared = Array.isArray(routine?.declaredFields) ? routine.declaredFields : [];
      return declared.map((field) =>
        this.recordField(field.key, record, isFound(record?.[field.key]), routine),
      );
    },
    async submitJob(record, routine) {
      const job = toJobPayload(record, routine);
      assertCompleteJob(job, routine);
      const response = await send?.({
        action: "scrapeQueue:enqueue",
        payload: { runId, job },
      });
      if (!response?.id) throw new Error("Failed to enqueue scraped job");
      applySnapshot(response.state);
      enqueued.push({ id: response.id, runId, job });
      recentJobs = addRecentJob(recentJobs, {
        key: `job-${job.id}`,
        title: job.title?.trim() || "Untitled job",
        company: job.company?.name?.trim() || "",
        status: "queued",
      });
      return response;
    },
  };
}
