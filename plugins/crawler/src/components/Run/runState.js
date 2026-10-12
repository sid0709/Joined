import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats";

/** How many recently read jobs the Run tab lists. */
export const RECENT_JOBS_LIMIT = 6;

/** A pass's phases as the run stepper groups them. */
export const RUN_STEPS = [
  { label: "Open", phases: ["open", "ready"] },
  { label: "Read", phases: ["read"] },
  { label: "Save", phases: ["submit"] },
  { label: "Next", phases: ["dismiss", "settle"] },
];

export function runStepIndex(phase) {
  return Math.max(
    0,
    RUN_STEPS.findIndex((step) => step.phases.includes(phase)),
  );
}

/** How a job (or a run outcome) reads in the panel: label, Badge variant, SegmentBar tone. */
export const JOB_STATUS = {
  queued: { label: "Queued", badge: "cyan" },
  [SCRAPE_OUTCOMES.REGISTERED]: { label: "Saved", badge: "success", tone: "green" },
  [SCRAPE_OUTCOMES.DUPLICATE]: { label: "Duplicate", badge: "blue", tone: "blue" },
  [SCRAPE_OUTCOMES.BLOCKED]: { label: "Blocked", badge: "orange", tone: "orange" },
  [SCRAPE_OUTCOMES.VALIDATION]: { label: "Incomplete", badge: "neutral", tone: "neutral" },
  [SCRAPE_OUTCOMES.FAILED]: { label: "Failed", badge: "error", tone: "red" },
};

/** Run outcomes in the order the results bar shows them. */
export const OUTCOME_ORDER = [
  SCRAPE_OUTCOMES.REGISTERED,
  SCRAPE_OUTCOMES.DUPLICATE,
  SCRAPE_OUTCOMES.BLOCKED,
  SCRAPE_OUTCOMES.VALIDATION,
  SCRAPE_OUTCOMES.FAILED,
];

export const outcomeSegments = (stats) =>
  OUTCOME_ORDER.map((outcome) => ({
    label: JOB_STATUS[outcome].label,
    value: stats[outcome] ?? 0,
    tone: JOB_STATUS[outcome].tone,
  }));

/**
 * A field's state after one read:
 * - "ok": found, and its rules (if any) pass.
 * - "empty": nothing on the page, but nothing requires it.
 * - "invalid": a rule for it fails.
 * Before its read a field is "pending"; during it, "reading".
 */
export function fieldStatus(found, valid) {
  if (valid === false) return "invalid";
  return found ? "ok" : "empty";
}

export const pendingFields = (routine) => {
  const keys = Array.isArray(routine?.declaredFields)
    ? routine.declaredFields.map((field) => field.key)
    : Object.keys(routine?.fields ?? {});
  return Object.fromEntries(keys.map((path) => [path, "pending"]));
};

/** Count one read of a field, for its hit rate across the run. */
export function recordFieldHit(hits, path, found) {
  const current = hits[path] ?? { found: 0, reads: 0 };
  return { ...hits, [path]: { found: current.found + (found ? 1 : 0), reads: current.reads + 1 } };
}

/** Percent of reads that found the field, or null before its first read. */
export const hitRate = (hit) => (hit?.reads ? Math.round((hit.found / hit.reads) * 100) : null);

/** Run-wide field header: prefer accumulated hits over the last card's states. */
export function fieldRunSummary(fields, fieldHits, fieldStates) {
  const keys = (fields ?? []).map((field) => field.key);
  const withHits = keys.filter((key) => fieldHits?.[key]?.reads);
  if (withHits.length) {
    return {
      found: withHits.filter((key) => fieldHits[key].found > 0).length,
      invalid: withHits.filter((key) => fieldHits[key].found === 0).length,
      total: keys.length,
    };
  }
  return {
    found: keys.filter((key) => fieldStates?.[key] === "ok").length,
    invalid: keys.filter((key) => fieldStates?.[key] === "invalid").length,
    total: keys.length,
  };
}

export const addRecentJob = (jobs, job, limit = RECENT_JOBS_LIMIT) =>
  [job, ...jobs.filter((existing) => existing.key !== job.key)].slice(0, limit);

export const updateRecentJob = (jobs, key, changes) =>
  jobs.map((job) => (job.key === key ? { ...job, ...changes } : job));

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "this page";
  }
}

/** Why Start is unavailable, in words for the person, or null when a run can start. */
export function startBlocker({
  hasRuntime,
  apiUrl,
  ingestToken,
  duplicateWindowDays,
  tab,
  routine,
}) {
  if (!hasRuntime) return "Open this panel from the extension to run routines.";
  if (!apiUrl) return "Set VITE_API_URL in plugins/crawler/.env, then rebuild.";
  if (!ingestToken) return "Set VITE_CRAWLER_INGEST_TOKEN in plugins/crawler/.env, then rebuild.";
  if (!duplicateWindowDays)
    return "Set VITE_DUPLICATE_WINDOW_DAYS (1–365) in plugins/crawler/.env, then rebuild.";
  if (!tab) return "Focus a web page to scrape.";
  if (!routine) return `No routine runs on ${hostOf(tab.url)} yet.`;
  return null;
}
