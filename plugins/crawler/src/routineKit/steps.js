/**
 * Step builders: what a routine does on the page. Each returns plain data.
 * Selectors follow the same rules as fields: a CSS selector, or a list tried in order.
 */

/** What a step does when its element is missing. */
export const ON_MISSING = Object.freeze({
  /** Fail the pass (the run moves on to the next pass). */
  FAIL: "fail",
  /** Ignore it and run the next step. */
  SKIP: "skip",
  /** End the run: there is nothing left to process. */
  FINISH: "finish",
});

export const DEFAULT_STEP_WAIT_MS = 2000;
export const DEFAULT_POLL_INTERVAL_MS = 100;

export const STEP_KINDS = ["highlight", "clear", "pause", "click", "waitFor", "waitGone"];

/** Outline every match on the page. */
export const highlight = (selector) => ({ kind: "highlight", selector });

/** Remove every outline. */
export const clearHighlights = () => ({ kind: "clear" });

/** Wait a fixed time, e.g. for an animation the page gives no signal for. */
export const pause = (ms) => ({ kind: "pause", ms });

/** Click the `nth` match, waiting up to `wait` ms for it. Outlines it first unless `highlight: false`. */
export const click = (
  selector,
  {
    nth = 0,
    wait = DEFAULT_STEP_WAIT_MS,
    highlight: shouldHighlight = true,
    onMissing = ON_MISSING.FAIL,
  } = {},
) => ({ kind: "click", selector, nth, wait, highlight: shouldHighlight, onMissing });

/** Wait until the selector matches. */
export const waitFor = (
  selector,
  {
    timeout = DEFAULT_STEP_WAIT_MS,
    interval = DEFAULT_POLL_INTERVAL_MS,
    onMissing = ON_MISSING.FAIL,
  } = {},
) => ({ kind: "waitFor", selector, timeout, interval, onMissing });

/**
 * Wait until the selector no longer matches. Never fails: it gives up after `timeout`.
 * With `notice`, the run reports "<notice>: done" or "<notice>: timed out".
 */
export const waitGone = (
  selector,
  { timeout = DEFAULT_STEP_WAIT_MS, interval = DEFAULT_POLL_INTERVAL_MS, notice = null } = {},
) => ({ kind: "waitGone", selector, timeout, interval, notice });
