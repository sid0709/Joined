export const PACE_STORAGE_KEY = "crawlerPaceSettingsV1";

export const DEFAULT_CONCURRENCY = 8;
export const MAX_CONCURRENCY = 16;
export const MIN_CONCURRENCY = 1;

export const DEFAULT_JOBS_PER_SECOND = 10;
export const MAX_JOBS_PER_SECOND = 50;
export const MIN_JOBS_PER_SECOND = 1;

export const MAX_BLOCKS_IN_WINDOW = 5;
export const BLOCK_WINDOW_MS = 60_000;
export const BACKOFF_PAUSE_MS = 2_000;
export const BACKOFF_RAMP_EVERY = 4;

export const DEFAULT_PACE_SETTINGS = Object.freeze({
  concurrency: DEFAULT_CONCURRENCY,
  jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
});

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampPaceSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    concurrency: clampInt(
      source.concurrency,
      MIN_CONCURRENCY,
      MAX_CONCURRENCY,
      DEFAULT_CONCURRENCY,
    ),
    jobsPerSecond: clampInt(
      source.jobsPerSecond,
      MIN_JOBS_PER_SECOND,
      MAX_JOBS_PER_SECOND,
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
