import { IncompleteJobDataError } from "../../api/jobValidation.js";
import {
  RoutineBlockedError,
  RoutineFinishedError,
  RoutineStepError,
  RoutineStoppedError,
} from "../../routineKit/runner.js";

import { detectHiringCafeBlock, isHiringCafeChallenge } from "./challenge.js";
import {
  CHALLENGE_NOTICE,
  CHALLENGE_POLL_MS,
  CHALLENGE_WAIT_LABEL,
  DETAIL_READY_MS,
  DETAIL_READY_POLL_MS,
  NAVIGATE_WAIT_MS,
  RETRY_PAUSE_MS,
} from "./constants.js";
import { isJobDetailReady } from "./detailReady.js";

export function isAbortError(error) {
  return (
    error instanceof RoutineStoppedError ||
    error?.name === "RoutineStoppedError" ||
    error?.name === "AbortError"
  );
}

export function isTimeoutError(error) {
  return /timed out/i.test(String(error?.message || error || ""));
}

export function stripTrailingSlash(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.href;
  } catch {
    return url;
  }
}

export function sameUrl(left, right) {
  return stripTrailingSlash(left) === stripTrailingSlash(right);
}

export async function readVisiblePage(call) {
  const result = await call("html");
  if (!result?.html && !detectHiringCafeBlock(result).blocked) {
    throw new RoutineStepError("The page did not return HTML");
  }
  return {
    html: result?.html || "",
    url: result?.url || "",
    status: result?.status || 200,
  };
}

export function createWithRetry({ ctx, skipDelays, rest, notePageFailure, onActivity }) {
  return async function withRetry(fn, pageUrl) {
    for (;;) {
      ctx.checkStopped();
      try {
        return await fn();
      } catch (error) {
        if (
          isAbortError(error) ||
          error instanceof RoutineFinishedError ||
          error instanceof RoutineBlockedError ||
          error instanceof IncompleteJobDataError ||
          error?.name === "IncompleteJobDataError"
        ) {
          throw error;
        }
        notePageFailure(pageUrl);
        onActivity?.({
          phase: "ready",
          label: isTimeoutError(error) ? "Retrying after timeout" : "Retrying after a page error",
          kind: "waitFor",
        });
        if (!skipDelays) await rest(RETRY_PAUSE_MS);
      }
    }
  };
}

export async function waitForChallengeClear({ ctx, call, rest, skipDelays, onActivity, onNotice }) {
  onActivity?.({ phase: "settle", label: CHALLENGE_WAIT_LABEL, kind: "waitFor" });
  onNotice?.(CHALLENGE_NOTICE, false);
  for (;;) {
    ctx.checkStopped();
    const page = await readVisiblePage(call);
    if (!isHiringCafeChallenge(page)) return page;
    if (skipDelays) return readVisiblePage(call);
    await rest(CHALLENGE_POLL_MS);
  }
}

export function createOpenVisible({ withRetry, call, onActivity }) {
  return async function openVisible(url, label, phase = "open") {
    return withRetry(async () => {
      const current = await readVisiblePage(call);
      if (isHiringCafeChallenge(current)) return current;
      if (sameUrl(current.url, url) && current.html) return current;
      onActivity?.({ phase, label, kind: "click" });
      await call("navigate", { url, timeout: NAVIGATE_WAIT_MS }, NAVIGATE_WAIT_MS);
      return readVisiblePage(call);
    }, url);
  };
}

export function createWaitForDetailReady({ call, rest, skipDelays, onActivity, checkStopped }) {
  return async function waitForDetailReady() {
    let page = await readVisiblePage(call);
    if (isJobDetailReady(page.html)) return page;
    onActivity?.({
      phase: "ready",
      label: "Waiting for job page data",
      kind: "waitFor",
    });
    if (skipDelays) {
      return readVisiblePage(call);
    }
    const deadline = Date.now() + DETAIL_READY_MS;
    while (Date.now() < deadline) {
      checkStopped();
      await rest(DETAIL_READY_POLL_MS);
      page = await readVisiblePage(call);
      if (isJobDetailReady(page.html)) return page;
    }
    return page;
  };
}
