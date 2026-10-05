/* global chrome */
import { useCallback, useEffect, useRef, useState } from "react";

import { IncompleteJobDataError, mergeJobValidationChecklist } from "../../../api/jobValidation";
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
  handleAction,
  handleClear,
  rememberActivePageTab,
} from "../../../contentScript/interactionBridge";

import { pendingValidationChecklist, scrapeJobDetail } from "./scrapeJobDetail";

/** The scrape loop's state, its runtime listeners, and Start/Stop. */
export function useScrapeRun() {
  const [progress, setProgress] = useState(0);
  const [scrapFlag, setScrapFlag] = useState(false);
  const [validationChecks, setValidationChecks] = useState(pendingValidationChecklist);
  const [runStats, setRunStats] = useState(createScrapeRunStats);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [starting, setStarting] = useState(false);
  const [targetTab, setTargetTab] = useState(null);
  const [queueCounts, setQueueCounts] = useState({ queued: 0, saving: 0 });

  const { addListener, removeListener } = useRuntime();
  const notification = useNotification();
  const pendingResolvers = useRef(new Map());
  const runStartedAt = useRef(null);
  const runIdRef = useRef(null);
  const scrapActiveRef = useRef(false);

  const fetchFromPage = useCallback((tag, property, pattern) => {
    const id = `scrap_wait_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const promise = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
    handleAction(tag, property, pattern, 0, "fetch", null, "content", id);
    return promise;
  }, []);

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

  const notifyFailure = useCallback(
    (err, fallback) => {
      notification.fail(err, { key: "scrap-failure", autoHideDuration: 2200 });
      if (fallback) console.error(fallback, err);
    },
    [notification],
  );

  const completeValidation = useCallback((ruleIds, partialJob) => {
    setValidationChecks((current) => mergeJobValidationChecklist(current, partialJob, ruleIds));
  }, []);

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

  useEffect(() => {
    const listener = (message) => {
      if (message?.action === "fetchResult") {
        const id = message.payload?.identifier;
        const resolver = id ? pendingResolvers.current.get(id) : null;
        if (id) {
          if (resolver) {
            resolver(message.payload);
            pendingResolvers.current.delete(id);
          }
        }
      }
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

  const onClickListItem = () =>
    scrapeJobDetail({
      setProgress,
      setValidationChecks,
      completeValidation,
      pendingResolvers,
      sendRuntimeMessage,
      fetchFromPage,
      runIdRef,
      scrapActiveRef,
      notification,
    });

  useEffect(() => {
    let active = true;

    const run = async () => {
      while (active && scrapFlag) {
        try {
          await onClickListItem();
        } catch (err) {
          console.log("error:[on clicked] ", err);
          if (err instanceof IncompleteJobDataError) {
            recordOutcome(SCRAPE_OUTCOMES.VALIDATION);
            console.warn("Skipping job with invalid data", err.issues);
            setProgress(0);
            handleClear();
            continue;
          }
          recordOutcome(SCRAPE_OUTCOMES.FAILED);
          notifyFailure(err, "Error in scrape loop");
        }
      }
    };

    if (scrapFlag) {
      run();
    }

    return () => {
      active = false;
    };
    // onClickListItem is rebuilt every render; listing it would restart the running scrape loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrapFlag, notifyFailure, recordOutcome]);

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
    scrapActiveRef.current = true;
    try {
      const rememberedTab = await rememberActivePageTab();
      if (!rememberedTab) {
        throw new Error("Focus the job scraping website, then click Start again.");
      }
      setTargetTab(rememberedTab);
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
      runStartedAt.current = Date.now();
      setScrapFlag(true);
    } catch (error) {
      scrapActiveRef.current = false;
      clearRememberedPageTab();
      notifyFailure(error, "Unable to remember the scraping tab");
    } finally {
      setStarting(false);
    }
  };

  const onScrapStop = () => {
    scrapActiveRef.current = false;
    if (runStartedAt.current) {
      setElapsedMs(Date.now() - runStartedAt.current);
      runStartedAt.current = null;
    }
    clearRememberedPageTab();
    setScrapFlag(false);
    setProgress(0);
    setValidationChecks(pendingValidationChecklist());
  };

  return {
    progress,
    scrapFlag,
    starting,
    validationChecks,
    runStats,
    elapsedMs,
    targetTab,
    queueCounts,
    onScrapStart,
    onScrapStop,
  };
}
