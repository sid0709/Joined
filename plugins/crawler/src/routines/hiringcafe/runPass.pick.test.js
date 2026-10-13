import { describe, expect, test } from "bun:test";

import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats.js";
import { DETAIL_TAB_BATCH } from "../../routineKit/detailTabs.js";

import { CARD_SKIP_ALREADY_APPLIED } from "./constants.js";
import { pickJobBatch, pickNextJob } from "./runPass.js";

const FRESH = { id: "reqfresh11111111", listApplied: false };
const APPLIED = { id: "reqapplied111111", listApplied: true };

describe("pickNextJob list-card Applied skip", () => {
  test("skips Applied ✓ list cards before hover or open and never marks them handled", async () => {
    const decisions = [];
    const outcomes = [];
    const marked = [];
    const appliedReads = [];
    const paces = [];
    const next = await pickNextJob({
      jobs: [APPLIED, FRESH],
      lastJobId: "",
      handledIds: new Set(),
      noteJobDecision: (id, decision) => decisions.push({ id, decision }),
      recordOutcome: (outcome) => outcomes.push(outcome),
      markJob: async (id) => marked.push(id),
      readApplied: async (job) => {
        appliedReads.push(job.id);
        return { marked: false };
      },
      markAppliedEnabled: true,
      emitCursor: (extra) => paces.push(extra),
    });
    expect(next).toEqual(FRESH);
    expect(decisions).toEqual([{ id: APPLIED.id, decision: CARD_SKIP_ALREADY_APPLIED }]);
    expect(outcomes).toEqual([SCRAPE_OUTCOMES.DUPLICATE]);
    expect(marked).toEqual([]);
    expect(appliedReads).toEqual([FRESH.id]);
    expect(paces).toEqual([
      expect.objectContaining({
        card: APPLIED.id,
        skipDelta: { skippedApplied: 1 },
      }),
    ]);
  });

  test("skips a feed card whose hover overlay already shows Applied", async () => {
    const decisions = [];
    const paces = [];
    const marked = [];
    const overlayApplied = { id: "reqoverlay111111", listApplied: false };
    const next = await pickNextJob({
      jobs: [overlayApplied, FRESH],
      lastJobId: "",
      handledIds: new Set(),
      noteJobDecision: (id, decision) => decisions.push({ id, decision }),
      recordOutcome: () => {},
      markJob: async (id) => marked.push(id),
      readApplied: async (job) => ({ marked: job.id === overlayApplied.id }),
      markAppliedEnabled: true,
      emitCursor: (extra) => paces.push(extra),
    });
    expect(next).toEqual(FRESH);
    expect(decisions).toEqual([{ id: overlayApplied.id, decision: CARD_SKIP_ALREADY_APPLIED }]);
    expect(marked).toEqual([overlayApplied.id]);
    expect(paces).toEqual([
      expect.objectContaining({
        card: overlayApplied.id,
        skipDelta: { skippedApplied: 1 },
      }),
    ]);
  });

  test("does not re-mark an already-handled Applied card", async () => {
    const marked = [];
    const next = await pickNextJob({
      jobs: [APPLIED],
      lastJobId: "",
      handledIds: new Set([APPLIED.id]),
      noteJobDecision: () => {},
      markJob: async (id) => marked.push(id),
      readApplied: async () => {
        throw new Error("must not hover an Applied list card");
      },
      markAppliedEnabled: true,
    });
    expect(next).toBeNull();
    expect(marked).toEqual([]);
  });
});

describe("pickJobBatch", () => {
  test("picks at most DETAIL_TAB_BATCH unhandled jobs in page order", async () => {
    const jobs = Array.from({ length: DETAIL_TAB_BATCH + 5 }, (_, index) => ({
      id: `job${index}`,
      url: `https://hiringcafe.com/job/x-job${index}`,
    }));
    const batch = await pickJobBatch({
      jobs,
      lastJobId: "job1",
      limit: DETAIL_TAB_BATCH,
      handledIds: new Set(["job3"]),
      noteJobDecision: () => {},
      markJob: async () => {},
      readApplied: async () => ({ marked: false }),
      markAppliedEnabled: false,
    });
    expect(batch.jobs).toHaveLength(DETAIL_TAB_BATCH);
    expect(batch.jobs[0].id).toBe("job2");
    expect(batch.jobs.map((job) => job.id)).not.toContain("job3");
  });

  test("a challenge before the first pick stops the batch", async () => {
    const batch = await pickJobBatch({
      jobs: [{ id: "a" }, { id: "b" }],
      lastJobId: "",
      limit: DETAIL_TAB_BATCH,
      handledIds: new Set(),
      noteJobDecision: () => {},
      markJob: async () => {},
      readApplied: async () => ({ challenge: true }),
      markAppliedEnabled: true,
    });
    expect(batch).toEqual({ challenge: true, jobs: [] });
  });
});
