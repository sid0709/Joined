/* global chrome */
import { useCallback, useEffect, useRef, useState } from "react";

import { assertCompleteJob, IncompleteJobDataError } from "../../api/jobValidation";
import { useRuntime } from "../../api/runtimeContext";
import { execRoutineOp, hasExtensionRuntime, sendRuntimeMessage } from "../../api/runtimeMessage";
import {
  createScrapeRunStats,
  incrementScrapeRunStats,
  mergeScrapeRunStats,
  SCRAPE_OUTCOMES,
} from "../../api/scrapeRunStats";
import useNotification from "../../api/useNotification";
import { RUN_KEEPALIVE_PORT } from "../../background/runKeepalive";
import { QUIET_STEP_KINDS } from "../../routineKit/describe";
import {
  BOUND_TAB_CLOSED_MESSAGE,
  isBoundTabClosedError,
  ROUTINE_BIND_TAB_ACTION,
  ROUTINE_TAB_CLOSED_ACTION,
} from "../../routineKit/protocol";
import {
  RoutineBlockedError,
  RoutineFinishedError,
  RoutineStoppedError,
  runRoutinePass,
} from "../../routineKit/runner";

import { endBoundRun } from "./endBoundRun";
import { ingestAcceptFromOutcome } from "./ingestAccept";
import { toJobPayload } from "./jobPayload";
import { appendNotice, mergePace } from "./paceState";
import {
  applyActiveQueueSnapshot,
  EMPTY_QUEUE,
  newRunId,
  readDeclaredField,
} from "./routineRunSession";
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

const INGEST_ACCEPT_TIMEOUT_MS = 20_000;
const INGEST_ACCEPT_RETRIES = 1;

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
  const [pace, setPace] = useState(null);
  const [warning, setWarning] = useState(null);
  const [extractError, setExtractError] = useState(null);

  const { addListener, removeListener } = useRuntime();
  const notification = useNotification();
  const runStartedAt = useRef(null);
  const runIdRef = useRef(null);
  const abortRef = useRef(null);
  const targetRef = useRef(null);
  const passHooksRef = useRef(null);
  const phaseRef = useRef(null);
  // Queue item id → recent-job key, and results that arrived before their enqueue ack.
  const queueKeys = useRef(new Map());
  const earlyResults = useRef(new Map());
  const countedOutcomes = useRef(new Set());
  const ingestWaiters = useRef(new Map());
  const ingestOutcomes = useRef(new Map());

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

  const applyQueueSnapshot = useCallback((state) => {
    const applied = applyActiveQueueSnapshot(runIdRef.current, state);
    if (!applied) return false;
    setQueueCounts(applied.counts);
    if (applied.summary) {
      setRunStats((current) => mergeScrapeRunStats(current, applied.summary));
    }
    return true;
  }, []);

  const resolveIngestWaiter = useCallback((id, outcome) => {
    const waiter = ingestWaiters.current.get(id);
    if (waiter) {
      ingestWaiters.current.delete(id);
      waiter(outcome);
      return;
    }
    ingestOutcomes.current.set(id, outcome);
  }, []);

  const waitForIngestAccept = useCallback((id) => {
    return new Promise((resolve) => {
      const already = ingestOutcomes.current.get(id) ?? earlyResults.current.get(id);
      if (already) {
        ingestOutcomes.current.delete(id);
        earlyResults.current.delete(id);
        resolve(ingestAcceptFromOutcome(already));
        return;
      }
      let attempts = 0;
      const arm = () => {
        const timer = setTimeout(() => {
          ingestWaiters.current.delete(id);
          const late = ingestOutcomes.current.get(id) ?? earlyResults.current.get(id);
          if (late) {
            ingestOutcomes.current.delete(id);
            earlyResults.current.delete(id);
            resolve(ingestAcceptFromOutcome(late));
            return;
          }
          if (attempts < INGEST_ACCEPT_RETRIES) {
            attempts += 1;
            arm();
            return;
          }
          resolve(null);
        }, INGEST_ACCEPT_TIMEOUT_MS);
        ingestWaiters.current.set(id, (outcome) => {
          clearTimeout(timer);
          resolve(ingestAcceptFromOutcome(outcome));
        });
      };
      arm();
    });
  }, []);

  /** Validate a finished record and queue it for the backend. Throws IncompleteJobDataError. */
  const submitJob = useCallback(
    (record) => {
      const job = toJobPayload(record, targetRef.current?.routine);
      const entry = {
        key: `job-${job.id}`,
        title: job.title?.trim() || "Untitled job",
        company: job.companyName?.trim() || "",
        status: "queued",
      };
      try {
        assertCompleteJob(job, targetRef.current?.routine);
      } catch (error) {
        setRecentJobs((jobs) =>
          addRecentJob(jobs, { ...entry, status: SCRAPE_OUTCOMES.VALIDATION }),
        );
        throw error;
      }
      setRecentJobs((jobs) => addRecentJob(jobs, entry));
      return sendRuntimeMessage({
        action: "scrapeQueue:enqueue",
        payload: { runId: runIdRef.current, job },
      })
        .then(async (response) => {
          if (!response?.id) throw new Error("Failed to enqueue scraped job");
          applyQueueSnapshot(response.state);
          queueKeys.current.set(response.id, entry.key);
          const early = earlyResults.current.get(response.id);
          if (early) {
            earlyResults.current.delete(response.id);
            applyItemResult(entry.key, early);
          }
          if (!targetRef.current?.routine?.options?.waitForIngestAccept) return true;
          const accepted = early
            ? ingestAcceptFromOutcome(early)
            : await waitForIngestAccept(response.id);
          return accepted;
        })
        .catch((error) => {
          applyItemResult(entry.key, SCRAPE_OUTCOMES.FAILED);
          console.error("Failed to enqueue scraped job", error);
          throw error;
        });
    },
    [applyItemResult, applyQueueSnapshot, waitForIngestAccept],
  );

  const endRun = useCallback((nextStatus) => {
    abortRef.current?.abort();
    const tabId = targetRef.current?.tab?.id;
    if (Number.isFinite(tabId)) {
      void endBoundRun(tabId, { execRoutineOp, sendRuntimeMessage });
    }
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
      if (message?.action === ROUTINE_TAB_CLOSED_ACTION) {
        const closedId = message.tabId ?? message.payload?.tabId;
        if (closedId === targetRef.current?.tab?.id) {
          notification.fail(new Error(message.payload?.message || BOUND_TAB_CLOSED_MESSAGE), {
            key: "run-tab-closed",
            autoHideDuration: 4000,
          });
          endRun(RUN_STATUS.STOPPED);
        }
      }
      if (message?.action === "scrapeQueue:state") {
        applyQueueSnapshot(message.payload);
      }
      if (
        message?.action === "scrapeQueue:itemResult" &&
        message.payload?.runId === runIdRef.current
      ) {
        const { id, outcome } = message.payload;
        const key = queueKeys.current.get(id);
        if (key) applyItemResult(key, outcome);
        else earlyResults.current.set(id, outcome);
        resolveIngestWaiter(id, outcome);
        if (outcome && !countedOutcomes.current.has(id)) {
          countedOutcomes.current.add(id);
          setRunStats((current) => incrementScrapeRunStats(current, outcome));
        }
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
  }, [
    addListener,
    removeListener,
    applyItemResult,
    applyQueueSnapshot,
    notifyFailure,
    resolveIngestWaiter,
    endRun,
    notification,
  ]);

  useEffect(() => {
    if (status !== RUN_STATUS.RUNNING || !runStartedAt.current) return undefined;
    const updateElapsed = () => setElapsedMs(Date.now() - runStartedAt.current);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== RUN_STATUS.RUNNING) return undefined;
    const connect = globalThis.chrome?.runtime?.connect;
    if (typeof connect !== "function") return undefined;
    const port = connect({ name: RUN_KEEPALIVE_PORT });
    return () => {
      try {
        port.disconnect();
      } catch {
        // The service worker may already have dropped the port.
      }
    };
  }, [status]);

  // The loop reads the latest callbacks through this ref, so a re-render never restarts it.
  useEffect(() => {
    passHooksRef.current = {
      exec: async (payload) => {
        try {
          return await execRoutineOp(targetRef.current?.tab.id, payload);
        } catch (error) {
          if (isBoundTabClosedError(error)) endRun(RUN_STATUS.STOPPED);
          throw error;
        }
      },
      sleep: (ms) => execRoutineOp(targetRef.current?.tab.id, { op: "sleep", ms }),
      onProgress: setProgress,
      onActivity: (next) => {
        // A pass's field states reset when it starts reading, so a pass that ends early
        // (nothing left to open) leaves the last pass's results on screen.
        const isFirstRead = next.phase === "read" && phaseRef.current !== "read";
        phaseRef.current = next.phase;
        // Pauses and highlight tidying keep the last meaningful label on screen.
        setActivity((current) =>
          QUIET_STEP_KINDS.has(next.kind)
            ? { ...current, phase: next.phase, label: current?.label ?? null }
            : next,
        );
        if (next.field) {
          setFieldStates((current) => ({
            ...(isFirstRead ? pendingFields(targetRef.current.routine) : current),
            [next.field]: "reading",
          }));
        }
      },
      onField: (path, _value, record, found) => {
        const result = readDeclaredField(path, record, found, targetRef.current?.routine);
        setFieldStates((current) => ({
          ...current,
          [path]: fieldStatus(result.found, result.valid),
        }));
        setFieldHits((hits) => recordFieldHit(hits, path, result.found));
        if (result.error) {
          setExtractError(result.error.message);
          notification.warning(result.error.message, {
            key: "run-extract",
            autoHideDuration: 4000,
          });
        }
      },
      onRecord: submitJob,
      onPace: (next) => {
        setPace((current) => mergePace(current, next));
      },
      onNotice: (message, ok) => {
        if (!ok) {
          setExtractError((current) => appendNotice(current, message));
          notification.warning(message, { key: `run-notice-${message}`, autoHideDuration: 4000 });
        }
      },
      onFinished: (message) => {
        notification.success(message, { key: "run-finished", autoHideDuration: 3000 });
        endRun(RUN_STATUS.FINISHED);
      },
      onBlocked: (message) => {
        setWarning(message);
        notification.warning(message, { key: "run-blocked", autoHideDuration: 8000 });
        endRun(RUN_STATUS.STOPPED);
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
        try {
          await runRoutinePass(routine, { ...hooks, signal: abortRef.current?.signal });
        } catch (err) {
          if (err instanceof RoutineStoppedError) break;
          void hooks.exec({ op: "clear" }).catch(() => {});
          setProgress(0);
          if (err instanceof RoutineBlockedError) {
            hooks.onBlocked?.(err.message);
            break;
          }
          if (err instanceof RoutineFinishedError) {
            hooks.onFinished("No more jobs in the list. Run finished.");
            break;
          }
          if (err instanceof IncompleteJobDataError) {
            hooks.recordOutcome(SCRAPE_OUTCOMES.VALIDATION);
            hooks.onNotice?.(err.message, false);
            console.warn("Skipping job with invalid data", err.issues);
            continue;
          }
          hooks.recordOutcome(SCRAPE_OUTCOMES.FAILED);
          hooks.onNotice?.(err.message || "Error in routine pass", false);
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
      const previousRunId = runIdRef.current;
      runIdRef.current = newRunId();
      queueKeys.current.clear();
      earlyResults.current.clear();
      countedOutcomes.current.clear();
      await sendRuntimeMessage({
        action: ROUTINE_BIND_TAB_ACTION,
        tabId: tab.id,
        payload: { tabId: tab.id, windowId: tab.windowId, routineId: routine.id },
      }).catch((error) => {
        if (hasExtensionRuntime()) throw error;
        return null;
      });
      // Drop leftover items from this panel's last run only. Concurrent windows keep theirs.
      const cleared = await sendRuntimeMessage({
        action: "scrapeQueue:clear",
        payload: { runId: previousRunId, beginRunId: runIdRef.current },
      }).catch(() => null);
      setRunStats(createScrapeRunStats());
      setQueueCounts(EMPTY_QUEUE);
      setRecentJobs([]);
      setFieldHits({});
      setFieldStates(pendingFields(routine));
      setPassCount(0);
      phaseRef.current = null;
      setProgress(0);
      setActivity(null);
      setElapsedMs(0);
      setPace(null);
      setWarning(null);
      setExtractError(null);
      applyQueueSnapshot(cleared?.state);
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
    pace,
    warning,
    extractError,
    start,
    stop,
  };
}
