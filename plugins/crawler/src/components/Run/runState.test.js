import { describe, expect, test } from "bun:test";

import {
  createScrapeRunStats,
  formatElapsedTime,
  getSkippedScrapeCount,
  incrementScrapeRunStats,
} from "../../api/scrapeRunStats";

import {
  addRecentJob,
  fieldStatus,
  hitRate,
  outcomeSegments,
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
    expect(pendingFields(null)).toEqual({});
  });

  test("tracks how often each field is found", () => {
    let hits = recordFieldHit({}, "title", true);
    hits = recordFieldHit(hits, "title", false);
    hits = recordFieldHit(hits, "title", true);
    expect(hits.title).toEqual({ found: 2, reads: 3 });
    expect(hitRate(hits.title)).toBe(67);
    expect(hitRate(undefined)).toBeNull();
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
      { label: "Blocked", value: 0, tone: "neutral" },
      { label: "Incomplete", value: 0, tone: "orange" },
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
      duplicateWindowDays: 7,
      tab: { id: 1, url: "https://jobs.example/list" },
      routine: { id: "jobs" },
    };
    expect(startBlocker(ready)).toBeNull();
    expect(startBlocker({ ...ready, hasRuntime: false })).toMatch(/from the extension/);
    expect(startBlocker({ ...ready, apiUrl: null })).toMatch(/VITE_API_URL/);
    expect(startBlocker({ ...ready, duplicateWindowDays: null })).toMatch(/DUPLICATE_WINDOW/);
    expect(startBlocker({ ...ready, tab: null })).toBe("Focus a web page to scrape.");
    expect(startBlocker({ ...ready, routine: null })).toBe("No routine runs on jobs.example yet.");
    expect(startBlocker({ ...ready, routine: null, tab: { id: 1, url: "nope" } })).toBe(
      "No routine runs on this page yet.",
    );
  });
});
