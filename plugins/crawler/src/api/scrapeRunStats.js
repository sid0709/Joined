export const SCRAPE_OUTCOMES = Object.freeze({
  REGISTERED: "registered",
  DUPLICATE: "duplicate",
  VALIDATION: "validation",
  BLOCKED: "blocked",
  FAILED: "failed",
});

export function createScrapeRunStats() {
  return {
    registered: 0,
    duplicate: 0,
    validation: 0,
    blocked: 0,
    failed: 0,
  };
}

export function incrementScrapeRunStats(stats, outcome) {
  if (!Object.values(SCRAPE_OUTCOMES).includes(outcome)) return stats;
  return { ...stats, [outcome]: stats[outcome] + 1 };
}

/** Keep the higher count so a stale scrapeQueue summary cannot rewind this run. */
export function mergeScrapeRunStats(current, incoming) {
  const base = createScrapeRunStats();
  const next = { ...base, ...current };
  for (const key of Object.keys(base)) {
    next[key] = Math.max(Number(current?.[key]) || 0, Number(incoming?.[key]) || 0);
  }
  return next;
}

export function getSkippedScrapeCount(stats) {
  return stats.duplicate + stats.validation + stats.blocked;
}

export function formatElapsedTime(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return hours ? `${String(hours).padStart(2, "0")}:${clock}` : clock;
}
