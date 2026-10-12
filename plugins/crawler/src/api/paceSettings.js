/** Pace knobs. Change a tier here; the Run UI clamps to the default tier unless fast mode is on. */

export const PACE_STORAGE_KEY = "crawlerPaceSettingsV1";

export const PACE_TIER = Object.freeze({
  default: Object.freeze({ concurrency: 4, jobsPerSecond: 3 }),
  fast: Object.freeze({ concurrency: 8, jobsPerSecond: 10 }),
});

export const MIN_CONCURRENCY = 1;
export const MIN_JOBS_PER_SECOND = 1;

export const DEFAULT_CONCURRENCY = PACE_TIER.default.concurrency;
export const DEFAULT_JOBS_PER_SECOND = PACE_TIER.default.jobsPerSecond;
export const MAX_CONCURRENCY = PACE_TIER.fast.concurrency;
export const MAX_JOBS_PER_SECOND = PACE_TIER.fast.jobsPerSecond;

/** Fast mode is opt-in. Off uses the default tier as both the start and the cap. */
export const DEFAULT_FAST_MODE = false;

export const TOKEN_BUCKET_CAPACITY = 1;
export const WORKER_JITTER_MS = Object.freeze({ min: 25, max: 150 });

export const MAX_BLOCKS_IN_WINDOW = 5;
export const BLOCK_WINDOW_MS = 60_000;
export const BACKOFF_RAMP_EVERY = 4;

export const DEFAULT_PACE_SETTINGS = Object.freeze({
  concurrency: DEFAULT_CONCURRENCY,
  jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
  fastMode: DEFAULT_FAST_MODE,
});

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function paceLimits(fastMode) {
  return fastMode
    ? { concurrency: MAX_CONCURRENCY, jobsPerSecond: MAX_JOBS_PER_SECOND }
    : { concurrency: DEFAULT_CONCURRENCY, jobsPerSecond: DEFAULT_JOBS_PER_SECOND };
}

function readFastMode(source) {
  if (source.fastMode != null) return Boolean(source.fastMode);
  return DEFAULT_FAST_MODE;
}

export function clampPaceSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const fastMode = readFastMode(source);
  const limits = paceLimits(fastMode);
  return {
    fastMode,
    concurrency: clampInt(
      source.concurrency,
      MIN_CONCURRENCY,
      limits.concurrency,
      DEFAULT_CONCURRENCY,
    ),
    jobsPerSecond: clampInt(
      source.jobsPerSecond,
      MIN_JOBS_PER_SECOND,
      limits.jobsPerSecond,
      DEFAULT_JOBS_PER_SECOND,
    ),
  };
}

function chromeLocal() {
  return globalThis.chrome?.storage?.local ?? null;
}

function readKey(storage, key) {
  if (!storage?.get) return Promise.resolve(undefined);
  if (storage.get.length >= 2) {
    return new Promise((resolve, reject) => {
      storage.get(key, (items) => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve(items?.[key]);
      });
    });
  }
  return Promise.resolve(storage.get(key)).then((items) =>
    items && typeof items === "object" && key in items ? items[key] : items,
  );
}

function writeKey(storage, key, value) {
  if (!storage?.set) return Promise.resolve();
  if (storage.set.length >= 2) {
    return new Promise((resolve, reject) => {
      storage.set({ [key]: value }, () => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
  }
  return Promise.resolve(storage.set({ [key]: value }));
}

export async function loadPaceSettings(storage = chromeLocal()) {
  try {
    return clampPaceSettings(await readKey(storage, PACE_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_PACE_SETTINGS };
  }
}

export async function savePaceSettings(next, storage = chromeLocal()) {
  const settings = clampPaceSettings(next);
  await writeKey(storage, PACE_STORAGE_KEY, settings);
  return settings;
}
