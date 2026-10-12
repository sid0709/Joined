/** Parse a Retry-After header (delta-seconds or HTTP date) into a pause in ms. */
export function parseRetryAfter(value, now = Date.now) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return null;
  const clock = typeof now === "function" ? now() : now;
  return Math.max(0, at - clock);
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

export const DEFAULT_MAX_BLOCKS = 5;
export const DEFAULT_BLOCK_WINDOW_MS = 60_000;
export const DEFAULT_BACKOFF_PAUSE_MS = 2_000;
export const DEFAULT_MIN_CONCURRENCY = 1;
export const DEFAULT_RAMP_EVERY = 4;

/**
 * Adaptive concurrency: on a block, halve concurrency, pause (honour Retry-After),
 * then ramp back up one slot every few successes. Stop when too many blocks land
 * in the window.
 */
export function createAdaptiveBackoff({
  maxConcurrency,
  minConcurrency = DEFAULT_MIN_CONCURRENCY,
  maxBlocks = DEFAULT_MAX_BLOCKS,
  windowMs = DEFAULT_BLOCK_WINDOW_MS,
  pauseMs = DEFAULT_BACKOFF_PAUSE_MS,
  rampEvery = DEFAULT_RAMP_EVERY,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const max = Math.max(minConcurrency, Number(maxConcurrency) || minConcurrency);
  let concurrency = max;
  let successes = 0;
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
      concurrency = Math.max(minConcurrency, Math.floor(concurrency / 2) || minConcurrency);
      successes = 0;
      const shouldStop = blocks.length >= maxBlocks;
      const wait = parseRetryAfter(retryAfter, now) ?? pauseMs;
      if (wait > 0) await sleep(wait);
      return {
        stop: shouldStop,
        concurrency,
        blockCount: blocks.length,
        kind: String(kind || "block"),
      };
    },
  };
}
