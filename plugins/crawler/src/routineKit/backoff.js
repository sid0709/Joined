/** Parse a Retry-After header (delta-seconds or HTTP date) into a pause in ms. */

export const MAX_RETRY_AFTER_MS = 10 * 60 * 1000;
export const DEFAULT_MAX_BLOCKS = 5;
export const DEFAULT_BLOCK_WINDOW_MS = 60_000;
export const DEFAULT_BACKOFF_BASE_MS = 2_000;
export const DEFAULT_BACKOFF_MAX_MS = 60_000;
export const DEFAULT_MIN_CONCURRENCY = 1;
export const DEFAULT_RAMP_EVERY = 4;

export function parseRetryAfter(value, now = Date.now, maxMs = MAX_RETRY_AFTER_MS) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cap = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : MAX_RETRY_AFTER_MS;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(cap, Math.max(0, seconds * 1000));
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return null;
  const clock = typeof now === "function" ? now() : now;
  return Math.min(cap, Math.max(0, at - clock));
}

/** Exponential wait with 50–100% jitter, capped at `maxMs` (~60s). */
export function backoffWaitMs(
  attempt,
  { baseMs = DEFAULT_BACKOFF_BASE_MS, maxMs = DEFAULT_BACKOFF_MAX_MS, random = Math.random } = {},
) {
  const n = Math.max(1, Number(attempt) || 1);
  const base = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : DEFAULT_BACKOFF_BASE_MS;
  const cap = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : DEFAULT_BACKOFF_MAX_MS;
  const exp = Math.min(cap, base * 2 ** (n - 1));
  const wait = Math.round(exp * (0.5 + random() * 0.5));
  return Math.min(cap, Math.max(0, wait));
}

const CHALLENGE_RE =
  /captcha|cf-challenge|challenge-form|interstitial|access denied|pardon our interruption|verify you are (a )?human|are you a robot/i;

/**
 * A fetch is blocked on 429, 403, a Retry-After header, or a captcha/interstitial page.
 */
export function detectFetchBlock({ status, html = "", retryAfter } = {}) {
  const code = Number(status);
  if (code === 429) return { blocked: true, kind: "429" };
  if (code === 403) return { blocked: true, kind: "403" };
  if (retryAfter != null && String(retryAfter).trim()) {
    return { blocked: true, kind: "retry-after" };
  }
  if (html && CHALLENGE_RE.test(html)) return { blocked: true, kind: "challenge" };
  return { blocked: false, kind: "" };
}

const LOGIN_PATH_RE = /^\/auth\/login(?:\/|$)/i;

/**
 * A visible page is blocked on the same fetch signals, or when the tab landed
 * on a login wall. Job pages that only link to /auth/login are not a wall.
 */
export function detectPageBlock({ status, html = "", url = "", retryAfter } = {}) {
  const fetchBlock = detectFetchBlock({ status, html, retryAfter });
  if (fetchBlock.blocked) return fetchBlock;
  try {
    if (LOGIN_PATH_RE.test(new URL(url).pathname)) return { blocked: true, kind: "login" };
  } catch {
    // Ignore a malformed tab URL and fall through as not blocked.
  }
  return { blocked: false, kind: "" };
}

/**
 * Adaptive concurrency: on a block, halve concurrency, pause (Retry-After or
 * exponential jitter up to ~60s), then ramp back up one slot every few successes.
 * Stop when too many blocks land in the window.
 */
export function createAdaptiveBackoff({
  maxConcurrency,
  minConcurrency = DEFAULT_MIN_CONCURRENCY,
  maxBlocks = DEFAULT_MAX_BLOCKS,
  windowMs = DEFAULT_BLOCK_WINDOW_MS,
  pauseMs = DEFAULT_BACKOFF_BASE_MS,
  maxPauseMs = DEFAULT_BACKOFF_MAX_MS,
  maxRetryAfterMs = MAX_RETRY_AFTER_MS,
  rampEvery = DEFAULT_RAMP_EVERY,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
} = {}) {
  const max = Math.max(minConcurrency, Number(maxConcurrency) || minConcurrency);
  let concurrency = max;
  let successes = 0;
  let consecutiveBlocks = 0;
  const blocks = [];

  function prune(at) {
    const cutoff = at - windowMs;
    while (blocks.length && blocks[0].at < cutoff) blocks.shift();
  }

  return {
    get concurrency() {
      return concurrency;
    },
    get blockCount() {
      prune(now());
      return blocks.length;
    },
    get blocks() {
      prune(now());
      return blocks.map((entry) => ({ ...entry }));
    },
    onSuccess() {
      consecutiveBlocks = 0;
      successes += 1;
      if (successes < rampEvery || concurrency >= max) return concurrency;
      successes = 0;
      concurrency += 1;
      return concurrency;
    },
    async onBlock({ retryAfter, kind = "block" } = {}) {
      const at = now();
      prune(at);
      blocks.push({ at, kind: String(kind || "block") });
      consecutiveBlocks += 1;
      concurrency = Math.max(minConcurrency, Math.floor(concurrency / 2) || minConcurrency);
      successes = 0;
      const shouldStop = blocks.length >= maxBlocks;
      const wait =
        parseRetryAfter(retryAfter, now, maxRetryAfterMs) ??
        backoffWaitMs(consecutiveBlocks, { baseMs: pauseMs, maxMs: maxPauseMs, random });
      if (wait > 0) await sleep(wait);
      return {
        stop: shouldStop,
        concurrency,
        blockCount: blocks.length,
        kind: String(kind || "block"),
        waitMs: wait,
      };
    },
  };
}
