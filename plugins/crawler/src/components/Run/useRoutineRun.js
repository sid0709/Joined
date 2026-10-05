import { useCallback, useEffect, useRef, useState } from "react";

import {
  assertCompleteJob,
  IncompleteJobDataError,
  isJobFieldValid,
} from "../../api/jobValidation";
import { useRuntime } from "../../api/runtimeContext";
import { execRoutineOp, sendRuntimeMessage } from "../../api/runtimeMessage";
import {
  createScrapeRunStats,
  incrementScrapeRunStats,
  SCRAPE_OUTCOMES,
} from "../../api/scrapeRunStats";
import useNotification from "../../api/useNotification";
import { RoutineFinishedError, RoutineStoppedError, runRoutinePass } from "../../routineKit/runner";

import { toJobPayload } from "./jobPayload";
import {
  addRecentJob,
  fieldStatus,
  pendingFields,
  recordFieldHit,
  updateRecentJob,
} from "./runState";

/** Run states: "idle" (never run), "running", "finished" (nothing left), "stopped". */
export const RUN_STATUS = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  FINISHED: "finished",
  STOPPED: "stopped",
});

const EMPTY_QUEUE = { queued: 0, saving: 0 };

const newRunId = () =>
  globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * A routine run: start/stop, the pass loop, and everything the Run tab shows about it.
 * Each pass runs the routine once in the target tab and queues the job it reads.
 */
export function useRoutineRun() {
  const [status, setStatus] = useState(RUN_STATUS.IDLE);
  const [target, setTarget] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activity, setActivity] = useState(null);
  const [passCount, setPassCount] = useState(0);
  const [fieldStates, setFieldStates] = useState({});
  const [fieldHits, setFieldHits] = useState({});
  const [runStats, setRunStats] = useState(createScrapeRunStats);
  const [queueCounts, setQueueCounts] = useState(EMPTY_QUEUE);
  const [recentJobs, setRecentJobs] = useState([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const { addListener, removeListener } = useRuntime();
  const notification = useNotification();
  const runStartedAt = useRef(null);
  const runIdRef = useRef(null);
  const abortRef = useRef(null);
  const targetRef = useRef(null);
  const passHooksRef = useRef(null);
  // Queue item id → recent-job key, and results that arrived before their enqueue ack.
  const queueKeys = useRef(new Map());
  const earlyResults = useRef(new Map());

  const notifyFailure = useCallback(
    (err, fallback) => {
      notification.fail(err, { key: "run-failure", autoHideDuration: 2600 });
      if (fallback) console.error(fallback, err);
    },
    [notification],
  );

  const recordOutcome = useCallback((outcome) => {
    setRunStats((current) => incrementScrapeRunStats(current, outcome));
    if (runIdRef.current) {
      void sendRuntimeMessage({
        action: "scrapeQueue:recordOutcome",
        payload: { runId: runIdRef.current, outcome },
      }).catch((error) => console.error("Failed to persist scrape outcome", error));
    }
  }, []);

  const applyItemResult = useCallback((key, outcome) => {
    setRecentJobs((jobs) => updateRecentJob(jobs, key, { status: outcome }));
  }, []);

  /** Validate a finished record and queue it for the backend. Throws IncompleteJobDataError. */
  const submitJob = useCallback(
    (record) => {
      const job = toJobPayload(record);
      const entry = {
        key: `job-${job.id}`,
        title: job.title?.trim() || "Untitled job",
        company: job.company?.name?.trim() || "",
        status: "queued",
      };
      try {
        if (job.applyLink) assertCompleteJob(job);
      } catch (error) {
        setRecentJobs((jobs) =>
          addRecentJob(jobs, { ...entry, status: SCRAPE_OUTCOMES.VALIDATION }),
        );
        throw error;
      }
      setRecentJobs((jobs) => addRecentJob(jobs, entry));
      // Fire-and-forget: the pass must not wait on storage or the backend.
      sendRuntimeMessage({
        action: "scrapeQueue:enqueue",
        payload: { runId: runIdRef.current, job },
      })
        .then((response) => {
          if (!response?.id) return;
          queueKeys.current.set(response.id, entry.key);
          const early = earlyResults.current.get(response.id);
          if (early) {
            earlyResults.current.delete(response.id);
            applyItemResult(entry.key, early);
          }
        })
        .catch((error) => {
          applyItemResult(entry.key, SCRAPE_OUTCOMES.FAILED);
          console.error("Failed to enqueue scraped job", error);
        });
    },
    [applyItemResult],
  );

  const endRun = useCallback((nextStatus) => {
    abortRef.current?.abort();
    if (runStartedAt.current) {
      setElapsedMs(Date.now() - runStartedAt.current);
      runStartedAt.current = null;
    }
    setStatus(nextStatus);
    setProgress(0);
    setActivity(null);
  }, []);

  const stop = useCallback(() => endRun(RUN_STATUS.STOPPED), [endRun]);

  // Queue state and per-job results from the background.
  useEffect(() => {
    const listener = (message) => {
      if (message?.action === "scrapeQueue:state") {
        const state = message.payload;
        if (!state?.runId || (runIdRef.current && state.runId !== runIdRef.current)) return;
        if (!runIdRef.current) runIdRef.current = state.runId;
        setQueueCounts(state.counts || EMPTY_QUEUE);
        if (state.summary) setRunStats({ ...createScrapeRunStats(), ...state.summary });
      }
      if (
        message?.action === "scrapeQueue:itemResult" &&
        message.payload?.runId === runIdRef.current
      ) {
        const { id, outcome } = message.payload;
        const key = queueKeys.current.get(id);
        if (key) applyItemResult(key, outcome);
        else earlyResults.current.set(id, outcome);
        if (outcome === SCRAPE_OUTCOMES.FAILED) {
          notifyFailure(
            new Error(
              message.payload.error || message.payload.result?.error || "Failed to register job",
            ),
          );
        }
      }
    };
    addListener(listener);
    void sendRuntimeMessage({ action: "scrapeQueue:getState" })
      .then((response) => listener({ action: "scrapeQueue:state", payload: response?.state }))
      .catch(() => {
        // Outside the extension there is no queue to restore.
      });
    return () => removeListener(listener);
  }, [addListener, removeListener, applyItemResult, notifyFailure]);

  useEffect(() => {
    if (status !== RUN_STATUS.RUNNING || !runStartedAt.current) return undefined;
    const updateElapsed = () => setElapsedMs(Date.now() - runStartedAt.current);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  // The loop reads the latest callbacks through this ref, so a re-render never restarts it.
  useEffect(() => {
    passHooksRef.current = {
      exec: (payload) => execRoutineOp(targetRef.current?.tab.id, payload),
      onProgress: setProgress,
      onActivity: (next) => {
        // Pauses and highlight tidying keep the last meaningful label on screen.
        setActivity((current) =>
          QUIET_STEP_KINDS.has(next.kind) && current ? { ...current, phase: next.phase } : next,
        );
        if (next.field) setFieldStates((current) => ({ ...current, [next.field]: "reading" }));
      },
      onField: (path, _value, record, found) => {
        const valid = isJobFieldValid(toJobPayload(record), path);
        setFieldStates((current) => ({ ...current, [path]: fieldStatus(found, valid) }));
        setFieldHits((hits) => recordFieldHit(hits, path, found));
      },
      onRecord: submitJob,
      onNotice: (message, ok) => {
        if (!ok) notification.warning(message, { key: "run-notice", autoHideDuration: 2000 });
      },
      onFinished: (message) => {
        notification.success(message, { key: "run-finished", autoHideDuration: 3000 });
        endRun(RUN_STATUS.FINISHED);
      },
      recordOutcome,
      notifyFailure,
    };
  }, [submitJob, recordOutcome, notifyFailure, notification, endRun]);

  useEffect(() => {
    if (status !== RUN_STATUS.RUNNING) return undefined;
    let active = true;

    const run = async () => {
      while (active) {
        const hooks = passHooksRef.current;
        const { routine } = targetRef.current;
        setPassCount((count) => count + 1);
        setFieldStates(pendingFields(routine));
        try {
          await runRoutinePass(routine, { ...hooks, signal: abortRef.current?.signal });
        } catch (err) {
          if (err instanceof RoutineStoppedError) break;
          void hooks.exec({ op: "clear" }).catch(() => {});
          setProgress(0);
          if (err instanceof RoutineFinishedError) {
            hooks.onFinished("No more jobs in the list. Run finished.");
            break;
          }
          if (err instanceof IncompleteJobDataError) {
            hooks.recordOutcome(SCRAPE_OUTCOMES.VALIDATION);
            console.warn("Skipping job with invalid data", err.issues);
            continue;
          }
          hooks.recordOutcome(SCRAPE_OUTCOMES.FAILED);
          hooks.notifyFailure(err, "Error in routine pass");
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [status]);

  /** Start running `routine` in `tab`. The caller has already checked startBlocker. */
  const start = async (tab, routine) => {
    setIsStarting(true);
    try {
      targetRef.current = { tab, routine };
      setTarget({ tab, routine });
      runIdRef.current = newRunId();
      queueKeys.current.clear();
      earlyResults.current.clear();
      // Drop leftover queue items from earlier failed retries (delayed nextAttemptAt).
      await sendRuntimeMessage({ action: "scrapeQueue:clear" }).catch(() => {});
      setRunStats(createScrapeRunStats());
      setQueueCounts(EMPTY_QUEUE);
      setRecentJobs([]);
      setFieldHits({});
      setFieldStates(pendingFields(routine));
      setPassCount(0);
      setProgress(0);
      setActivity(null);
      setElapsedMs(0);
      abortRef.current = new AbortController();
      runStartedAt.current = Date.now();
      setStatus(RUN_STATUS.RUNNING);
    } catch (error) {
      notifyFailure(error, "Unable to start the run");
    } finally {
      setIsStarting(false);
    }
  };

  return {
    status,
    target,
    isStarting,
    progress,
    activity,
    passCount,
    fieldStates,
    fieldHits,
    runStats,
    queueCounts,
    recentJobs,
    elapsedMs,
    start,
    stop,
  };
}
