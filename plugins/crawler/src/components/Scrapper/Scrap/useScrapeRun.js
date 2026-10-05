/* global chrome */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  assertCompleteJob,
  getJobValidationChecklist,
  IncompleteJobDataError,
  mergeJobValidationChecklist,
  validationRuleIdsForField,
} from "../../../api/jobValidation";
import { useRuntime } from "../../../api/runtimeContext";
import {
  createScrapeRunStats,
  incrementScrapeRunStats,
  SCRAPE_OUTCOMES,
} from "../../../api/scrapeRunStats";
import useNotification from "../../../api/useNotification";
import { API_URL, DUPLICATE_WINDOW_DAYS } from "../../../config/env";
import {
  clearRememberedPageTab,
  rememberActivePageTab,
} from "../../../contentScript/interactionBridge";
import { findRoutineForUrl } from "../../../routineKit/match";
import { ROUTINE_EXEC_ACTION } from "../../../routineKit/protocol";
import {
  RoutineFinishedError,
  RoutineStoppedError,
  runRoutinePass,
} from "../../../routineKit/runner";
import { ROUTINES } from "../../../routines";
import { ROUTINE_OUTPUTS } from "../../../routines/outputs";

import { pendingValidationChecklist, toJobPayload } from "./jobPayload";

const JOB_ROUTINES = ROUTINES.filter((routine) => routine.output === ROUTINE_OUTPUTS.JOB);

function describeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "this page";
  }
}

/** The scrape loop's state, its runtime listeners, and Start/Stop. Each pass runs the tab's routine. */
export function useScrapeRun() {
  const [progress, setProgress] = useState(0);
  const [scrapFlag, setScrapFlag] = useState(false);
  const [validationChecks, setValidationChecks] = useState(pendingValidationChecklist);
  const [runStats, setRunStats] = useState(createScrapeRunStats);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [starting, setStarting] = useState(false);
  const [targetTab, setTargetTab] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [queueCounts, setQueueCounts] = useState({ queued: 0, saving: 0 });

  const { addListener, removeListener } = useRuntime();
  const notification = useNotification();
  const runStartedAt = useRef(null);
  const runIdRef = useRef(null);
  const abortRef = useRef(null);
  const targetTabRef = useRef(null);
  const routineRef = useRef(null);
  const passHooksRef = useRef(null);

  const sendRuntimeMessage = useCallback(
    (message) =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (response?.success === false)
            reject(new Error(response.error || "Background request failed"));
          else resolve(response);
        });
      }),
    [],
  );

  /** Run one routine op in the remembered tab (see contentScript/messages/routineOps.js). */
  const execOnPage = useCallback(
    (payload) =>
      sendRuntimeMessage({
        action: ROUTINE_EXEC_ACTION,
        tabId: targetTabRef.current?.id,
        payload,
      }).then((response) => response?.result ?? {}),
    [sendRuntimeMessage],
  );

  const notifyFailure = useCallback(
    (err, fallback) => {
      notification.fail(err, { key: "scrap-failure", autoHideDuration: 2200 });
      if (fallback) console.error(fallback, err);
    },
    [notification],
  );

  const recordOutcome = useCallback(
    (outcome) => {
      setRunStats((current) => incrementScrapeRunStats(current, outcome));
      if (runIdRef.current) {
        void sendRuntimeMessage({
          action: "scrapeQueue:recordOutcome",
          payload: { runId: runIdRef.current, outcome },
        }).catch((error) => console.error("Failed to persist scrape outcome", error));
      }
    },
    [sendRuntimeMessage],
  );

  /** Validate a finished record and queue it for the backend. Throws IncompleteJobDataError. */
  const submitJob = useCallback(
    (record) => {
      const job = toJobPayload(record);
      console.log("Scraped job data:", job);
      if (job.applyLink) {
        setValidationChecks(getJobValidationChecklist(job));
        assertCompleteJob(job);
      }
      // Fire-and-forget: the scrape loop must not block on the background
      // script acking storage/backend work, or a slow drain/backend stalls scraping.
      sendRuntimeMessage({
        action: "scrapeQueue:enqueue",
        payload: { runId: runIdRef.current, job },
      }).catch((error) => console.error("Failed to enqueue scraped job", error));
    },
    [sendRuntimeMessage],
  );

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
    if (runStartedAt.current) {
      setElapsedMs(Date.now() - runStartedAt.current);
      runStartedAt.current = null;
    }
    clearRememberedPageTab();
    setScrapFlag(false);
    setProgress(0);
    setValidationChecks(pendingValidationChecklist());
  }, []);

  useEffect(() => {
    const listener = (message) => {
      if (message?.action === "scrapeQueue:state") {
        const state = message.payload;
        if (!state?.runId || (runIdRef.current && state.runId !== runIdRef.current)) return;
        if (!runIdRef.current) runIdRef.current = state.runId;
        setQueueCounts(state.counts || { queued: 0, saving: 0 });
        if (state.summary) setRunStats({ ...createScrapeRunStats(), ...state.summary });
      }
      if (
        message?.action === "scrapeQueue:itemResult" &&
        message.payload?.runId === runIdRef.current
      ) {
        const outcome = message.payload.outcome;
        if (outcome === SCRAPE_OUTCOMES.REGISTERED) {
          notification.success("Job registered successfully", {
            key: "scrap-outcome",
            autoHideDuration: 1200,
          });
        } else if (outcome === SCRAPE_OUTCOMES.DUPLICATE) {
          notification.info(message.payload.result?.reason || "Duplicate job skipped", {
            key: "scrap-outcome",
            autoHideDuration: 1200,
          });
        } else if (outcome === SCRAPE_OUTCOMES.BLOCKED) {
          notification.warning(message.payload.result?.reason || "Job skipped by a blocking rule", {
            key: "scrap-outcome",
            autoHideDuration: 1500,
          });
        } else {
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
      .catch((error) => console.error("Failed to restore scrape queue state", error));
    return () => removeListener(listener);
  }, [addListener, removeListener, notification, notifyFailure, sendRuntimeMessage]);

  useEffect(() => {
    if (!scrapFlag || !runStartedAt.current) return undefined;
    const updateElapsed = () => setElapsedMs(Date.now() - runStartedAt.current);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [scrapFlag]);

  // The loop below reads the latest callbacks through this ref, so a re-render never
  // restarts a running scrape loop.
  useEffect(() => {
    passHooksRef.current = {
      exec: execOnPage,
      onProgress: setProgress,
      onField: (path, _value, record) =>
        setValidationChecks((current) =>
          mergeJobValidationChecklist(
            current,
            toJobPayload(record),
            validationRuleIdsForField(path),
          ),
        ),
      onRecord: submitJob,
      onNotice: (message) =>
        notification.info(message, { key: "scrap-close", autoHideDuration: 1200 }),
      onFinished: (message) => {
        notification.info(message, { key: "scrap-finished", autoHideDuration: 2500 });
        stopRun();
      },
      recordOutcome,
      notifyFailure,
    };
  }, [execOnPage, submitJob, recordOutcome, notifyFailure, notification, stopRun]);

  useEffect(() => {
    if (!scrapFlag) return undefined;
    let active = true;

    const run = async () => {
      while (active) {
        const hooks = passHooksRef.current;
        setValidationChecks(pendingValidationChecklist());
        try {
          await runRoutinePass(routineRef.current, { ...hooks, signal: abortRef.current?.signal });
        } catch (err) {
          if (err instanceof RoutineStoppedError) break;
          void hooks.exec({ op: "clear" }).catch(() => {});
          setProgress(0);
          if (err instanceof RoutineFinishedError) {
            hooks.onFinished(err.message);
            break;
          }
          if (err instanceof IncompleteJobDataError) {
            hooks.recordOutcome(SCRAPE_OUTCOMES.VALIDATION);
            console.warn("Skipping job with invalid data", err.issues);
            continue;
          }
          hooks.recordOutcome(SCRAPE_OUTCOMES.FAILED);
          hooks.notifyFailure(err, "Error in scrape loop");
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [scrapFlag]);

  const onScrapStart = async () => {
    if (!API_URL) {
      notifyFailure(new Error("API base URL is not configured"));
      return;
    }
    if (!DUPLICATE_WINDOW_DAYS) {
      notifyFailure(
        new Error(
          "VITE_DUPLICATE_WINDOW_DAYS must be a whole number from 1 to 365 in Extension/.env.",
        ),
      );
      return;
    }
    setStarting(true);
    try {
      const rememberedTab = await rememberActivePageTab();
      if (!rememberedTab) {
        throw new Error("Focus the job scraping website, then click Start again.");
      }
      const tabRoutine = findRoutineForUrl(JOB_ROUTINES, rememberedTab.url);
      if (!tabRoutine) {
        throw new Error(
          `No routine runs on ${describeHost(rememberedTab.url)}. Open a supported job site, then click Start again.`,
        );
      }
      targetTabRef.current = rememberedTab;
      routineRef.current = tabRoutine;
      setTargetTab(rememberedTab);
      setRoutine(tabRoutine);
      runIdRef.current =
        globalThis.crypto?.randomUUID?.() ||
        `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      // Drop leftover queue items from earlier failed retries (delayed nextAttemptAt).
      await sendRuntimeMessage({ action: "scrapeQueue:clear" }).catch(() => {});
      setRunStats(createScrapeRunStats());
      setQueueCounts({ queued: 0, saving: 0 });
      setValidationChecks(pendingValidationChecklist());
      setProgress(0);
      setElapsedMs(0);
      abortRef.current = new AbortController();
      runStartedAt.current = Date.now();
      setScrapFlag(true);
    } catch (error) {
      clearRememberedPageTab();
      notifyFailure(error, "Unable to start the scrape run");
    } finally {
      setStarting(false);
    }
  };

  return {
    progress,
    scrapFlag,
    starting,
    validationChecks,
    runStats,
    elapsedMs,
    targetTab,
    routine,
    queueCounts,
    onScrapStart,
    onScrapStop: stopRun,
  };
}
