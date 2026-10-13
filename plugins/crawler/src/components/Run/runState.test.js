import { describe, expect, test } from "bun:test";

import {
  createScrapeRunStats,
  formatElapsedTime,
  getSkippedScrapeCount,
  incrementScrapeRunStats,
  mergeScrapeRunStats,
} from "../../api/scrapeRunStats";

import {
  addRecentJob,
  applyPaceUpdate,
  EMPTY_PACE_COUNTS,
  fieldRunSummary,
  fieldStatus,
  hitRate,
  isActiveQueueRun,
  isStoppedOrBlocked,
  keepsPaceOnResume,
  outcomeSegments,
  paceAfterStart,
  runStatusMeta,
  statsAfterStart,
  pendingFields,
  RECENT_JOBS_LIMIT,
  recordFieldHit,
  runStepIndex,
  startBlocker,
  updateRecentJob,
} from "./runState";

describe("run state", () => {
  test("groups pass phases into the stepper's steps", () => {
    expect(runStepIndex("open")).toBe(0);
    expect(runStepIndex("ready")).toBe(0);
    expect(runStepIndex("read")).toBe(1);
    expect(runStepIndex("submit")).toBe(2);
    expect(runStepIndex("settle")).toBe(3);
    expect(runStepIndex(undefined)).toBe(0);
  });

  test("gives each field read a state", () => {
    expect(fieldStatus(true, null)).toBe("ok");
    expect(fieldStatus(true, true)).toBe("ok");
    expect(fieldStatus(false, true)).toBe("empty");
    expect(fieldStatus(false, null)).toBe("empty");
    expect(fieldStatus(true, false)).toBe("invalid");
    expect(pendingFields({ fields: { title: {}, "company.name": {} } })).toEqual({
      title: "pending",
      "company.name": "pending",
    });
    expect(
      pendingFields({
        declaredFields: [
          { key: "applyUrl", required: true },
          { key: "title", required: true },
        ],
      }),
    ).toEqual({ applyUrl: "pending", title: "pending" });
    expect(pendingFields(null)).toEqual({});
  });

  test("tracks how often each field is found", () => {
    let hits = recordFieldHit({}, "title", true);
    hits = recordFieldHit(hits, "title", false);
    hits = recordFieldHit(hits, "title", true);
    expect(hits.title).toEqual({ found: 2, reads: 3 });
    expect(hitRate(hits.title)).toBe(67);
    expect(hitRate(undefined)).toBeNull();
    expect(
      fieldRunSummary(
        [{ key: "applyUrl" }, { key: "companyName" }],
        { applyUrl: { found: 12, reads: 12 }, companyName: { found: 12, reads: 12 } },
        { applyUrl: "ok", companyName: "ok" },
      ),
    ).toEqual({ found: 2, invalid: 0, total: 2 });
    expect(
      fieldRunSummary(
        [{ key: "applyUrl" }, { key: "companyWebsite" }, { key: "companySocials" }],
        {
          applyUrl: { found: 12, reads: 12 },
          companyWebsite: { found: 0, reads: 12 },
          companySocials: { found: 0, reads: 12 },
        },
        { applyUrl: "ok", companyWebsite: "empty", companySocials: "empty" },
      ),
    ).toEqual({ found: 1, invalid: 0, total: 3 });
    expect(
      fieldRunSummary(
        [{ key: "applyUrl" }, { key: "companyName" }],
        { applyUrl: { found: 12, reads: 12 }, companyName: { found: 12, reads: 12 } },
        { applyUrl: "invalid", companyName: "invalid" },
      ),
    ).toEqual({ found: 2, invalid: 2, total: 2 });
    expect(fieldRunSummary([{ key: "title" }], {}, { title: "invalid" })).toEqual({
      found: 0,
      invalid: 1,
      total: 1,
    });
    expect(isActiveQueueRun(null, "run-old")).toBe(false);
    expect(isActiveQueueRun("run-new", "run-old")).toBe(false);
    expect(isActiveQueueRun("run-new", "run-new")).toBe(true);
    expect(mergeScrapeRunStats({ registered: 12 }, { registered: 3, failed: 1 })).toEqual({
      registered: 12,
      duplicate: 0,
      validation: 0,
      blocked: 0,
      failed: 1,
    });
  });

  test("keeps the newest jobs first, without duplicates, up to the limit", () => {
    let jobs = [];
    for (let index = 0; index < RECENT_JOBS_LIMIT + 2; index += 1) {
      jobs = addRecentJob(jobs, { key: `job-${index}`, status: "queued" });
    }
    expect(jobs).toHaveLength(RECENT_JOBS_LIMIT);
    expect(jobs[0].key).toBe(`job-${RECENT_JOBS_LIMIT + 1}`);
    jobs = addRecentJob(jobs, { key: jobs[2].key, status: "failed" });
    expect(jobs).toHaveLength(RECENT_JOBS_LIMIT);
    jobs = updateRecentJob(jobs, jobs[1].key, { status: "registered" });
    expect(jobs[1].status).toBe("registered");
    expect(jobs[0].status).toBe("failed");
  });

  test("turns run stats into results-bar segments", () => {
    const stats = incrementScrapeRunStats(createScrapeRunStats(), "registered");
    expect(incrementScrapeRunStats(stats, "unknown")).toBe(stats);
    expect(outcomeSegments(stats)).toEqual([
      { label: "Saved", value: 1, tone: "green" },
      { label: "Duplicate", value: 0, tone: "blue" },
      { label: "Blocked", value: 0, tone: "orange" },
      { label: "Incomplete", value: 0, tone: "neutral" },
      { label: "Failed", value: 0, tone: "red" },
    ]);
    expect(outcomeSegments({})[0].value).toBe(0);
    expect(getSkippedScrapeCount({ duplicate: 1, validation: 2, blocked: 3 })).toBe(6);
    expect(formatElapsedTime(65_000)).toBe("01:05");
    expect(formatElapsedTime(3_725_000)).toBe("01:02:05");
  });

  test("explains why a run cannot start", () => {
    const ready = {
      hasRuntime: true,
      apiUrl: "https://api.example",
      ingestToken: "secret",
      duplicateWindowDays: 7,
      tab: { id: 1, url: "https://jobs.example/list" },
      routine: { id: "jobs" },
    };
    expect(startBlocker(ready)).toBeNull();
    expect(startBlocker({ ...ready, hasRuntime: false })).toMatch(/from the extension/);
    expect(startBlocker({ ...ready, apiUrl: null })).toMatch(/VITE_API_URL/);
    expect(startBlocker({ ...ready, ingestToken: null })).toMatch(/VITE_CRAWLER_INGEST_TOKEN/);
    expect(startBlocker({ ...ready, duplicateWindowDays: null })).toMatch(/DUPLICATE_WINDOW/);
    expect(startBlocker({ ...ready, tab: null })).toBe("Focus a web page to scrape.");
    expect(startBlocker({ ...ready, routine: null })).toBe("No routine runs on jobs.example yet.");
    expect(startBlocker({ ...ready, routine: null, tab: { id: 1, url: "nope" } })).toBe(
      "No routine runs on this page yet.",
    );
  });

  test("keeps hearted counts on resume and zeros them for a new run", () => {
    const prior = { hearted: 35, notHearted: 3, marked: 0, notMarked: 0, markReasons: [] };
    expect(paceAfterStart(prior)).toEqual(prior);
    expect(paceAfterStart(prior, { resetHearts: true })).toEqual({
      ...EMPTY_PACE_COUNTS,
      markReasons: [],
    });
    expect(paceAfterStart(null)).toEqual({
      ...EMPTY_PACE_COUNTS,
      markReasons: [],
    });
    expect(applyPaceUpdate(prior, { page: 3, card: "9256204" })).toMatchObject({
      page: 3,
      card: "9256204",
      hearted: 35,
      notHearted: 3,
    });
    expect(applyPaceUpdate(prior, { heartDelta: { hearted: 1, notHearted: 0 } })).toMatchObject({
      hearted: 36,
      notHearted: 3,
    });
    expect(
      applyPaceUpdate(prior, { markDelta: { marked: 1, notMarked: 0, reason: "applied" } }),
    ).toMatchObject({
      marked: 1,
      notMarked: 0,
      markReasons: ["applied"],
    });
    expect(keepsPaceOnResume("stopped")).toBe(true);
    expect(keepsPaceOnResume("blocked")).toBe(true);
    expect(keepsPaceOnResume("idle")).toBe(false);
    expect(keepsPaceOnResume("finished")).toBe(false);
    expect(paceAfterStart(prior, { resetHearts: !keepsPaceOnResume("blocked") })).toEqual(prior);
  });

  test("keeps result counters on STOPPED or BLOCKED resume and zeros them for a new run", () => {
    const prior = {
      registered: 3,
      duplicate: 1,
      validation: 0,
      blocked: 0,
      failed: 0,
    };
    expect(statsAfterStart(prior)).toEqual(prior);
    expect(statsAfterStart(prior, { reset: !keepsPaceOnResume("stopped") })).toEqual(prior);
    expect(statsAfterStart(prior, { reset: !keepsPaceOnResume("blocked") })).toEqual(prior);
    expect(statsAfterStart(prior, { reset: true })).toEqual(createScrapeRunStats());
    expect(statsAfterStart(null)).toEqual(createScrapeRunStats());
    expect(statsAfterStart(prior, { reset: !keepsPaceOnResume("idle") })).toEqual(
      createScrapeRunStats(),
    );
    expect(isStoppedOrBlocked("stopped")).toBe(true);
    expect(isStoppedOrBlocked("blocked")).toBe(true);
    expect(isStoppedOrBlocked("running")).toBe(false);
    expect(runStatusMeta("stopped").title).toBe("Stopped");
    expect(runStatusMeta("blocked").title).toBe("Blocked");
    expect(runStatusMeta("running").title).toBe("Running");
    expect(runStatusMeta("idle").title).toBe("Stopped");
  });
});
