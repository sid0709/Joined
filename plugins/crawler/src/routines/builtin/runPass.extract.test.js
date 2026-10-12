import { describe, expect, test } from "bun:test";

import { IncompleteJobDataError } from "../../api/jobValidation.js";
import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats.js";
import { RoutineBlockedError } from "../../routineKit/runner.js";

import {
  CARD_SKIP_EXTRACT_FAILED,
  INVALID_STREAK,
  INVALID_STREAK_MESSAGE,
  cardDecisionLabel,
  cardExtractFailedDecision,
  cardInvalidDecision,
} from "./constants.js";
import { handledIdSet } from "./handled.js";
import { extractOpenedJob, noteExtractProblem } from "./runPass.js";

const JOB_ID = "9256204";
const DETAIL_ID = "9256204-detail";
const JOB_URL = "https://builtin.com/job/staff-principal-engineer/9256204";

const COMPLETE_DETAIL = {
  applyUrl: "https://careers.example/apply/9256204",
  title: "Staff Engineer",
  description: "Build things.",
  companyName: "Acme",
  meta: { id: DETAIL_ID },
};

const CARD = { id: JOB_ID, url: JOB_URL, companyName: "Acme" };

function extractCtx(overrides = {}) {
  const activities = [];
  const notices = [];
  const outcomes = [];
  const fields = [];
  const hooks = {
    parseDetail: () => ({ ...COMPLETE_DETAIL }),
    onActivity: (activity) => activities.push(activity),
    onNotice: (message, ok) => notices.push({ message, ok }),
    recordOutcome: (outcome) => outcomes.push(outcome),
    onField: (path, value, record, found) => fields.push({ path, value, found }),
    onRecord: async () => {},
    ...overrides,
  };
  return {
    activities,
    notices,
    outcomes,
    fields,
    ctx: {
      hooks,
      rest: async () => {},
      routine: { options: { fieldPauseMs: 0 }, declaredFields: [] },
    },
  };
}

function extract(ctx, { card = CARD, html = "<html></html>", handledIds, invalidStreak = 0 } = {}) {
  return extractOpenedJob(
    ctx,
    { tick() {} },
    card,
    { html, url: card.url },
    handledIds ?? handledIdSet([]),
    invalidStreak,
  );
}

describe("noteExtractProblem", () => {
  test("records a dismiss line, outcome, and failed notice", () => {
    const bag = extractCtx();
    const decision = cardExtractFailedDecision(new Error("checker exploded"));
    noteExtractProblem(bag.ctx.hooks, JOB_ID, decision, SCRAPE_OUTCOMES.FAILED);
    expect(bag.activities).toEqual([
      {
        phase: "dismiss",
        label: cardDecisionLabel(JOB_ID, decision),
        kind: "waitFor",
      },
    ]);
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.FAILED]);
    expect(bag.notices).toEqual([{ message: cardDecisionLabel(JOB_ID, decision), ok: false }]);
  });

  test("tolerates missing panel hooks", () => {
    expect(() =>
      noteExtractProblem({}, JOB_ID, CARD_SKIP_EXTRACT_FAILED, SCRAPE_OUTCOMES.FAILED),
    ).not.toThrow();
  });
});

describe("extractOpenedJob", () => {
  test("notes a thrown parseDetail as FAILED and increments the invalid streak", async () => {
    const bag = extractCtx({
      parseDetail: () => {
        throw new Error("detail DOM collapsed");
      },
    });
    const result = await extract(bag.ctx);
    expect(result).toEqual({
      jobId: JOB_ID,
      invalidStreak: 1,
      skipped: true,
    });
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.FAILED]);
    expect(bag.notices[0]).toEqual({
      message: cardDecisionLabel(
        JOB_ID,
        cardExtractFailedDecision(new Error("detail DOM collapsed")),
      ),
      ok: false,
    });
  });

  test("skips a job-page that is already handled", async () => {
    const bag = extractCtx();
    const result = await extract(bag.ctx, { handledIds: handledIdSet([DETAIL_ID]) });
    expect(result).toEqual({
      jobId: JOB_ID,
      detailId: DETAIL_ID,
      savedOnPage: true,
      invalidStreak: 0,
    });
    expect(bag.outcomes).toEqual([]);
    expect(bag.fields).toEqual([]);
  });

  test("notes a thrown field report as FAILED", async () => {
    const bag = extractCtx({
      onField: () => {
        throw new Error("checker exploded");
      },
      routine: undefined,
    });
    bag.ctx.routine = {
      options: { fieldPauseMs: 0 },
      declaredFields: [{ key: "title", label: "Title" }],
    };
    const result = await extract(bag.ctx);
    expect(result.skipped).toBe(true);
    expect(result.invalidStreak).toBe(1);
    expect(result.detailId).toBe(DETAIL_ID);
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.FAILED]);
    expect(bag.notices[0].message).toContain("extract failed (checker exploded)");
  });

  test("notes missing required fields as VALIDATION", async () => {
    const bag = extractCtx({
      parseDetail: () => ({
        applyUrl: "",
        title: "",
        description: "",
        companyName: "",
        meta: { id: DETAIL_ID },
      }),
    });
    const result = await extract(bag.ctx);
    expect(result.skipped).toBe(true);
    expect(result.invalidStreak).toBe(1);
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.VALIDATION]);
    expect(bag.notices[0].message).toBe(
      cardDecisionLabel(
        JOB_ID,
        cardInvalidDecision(["applyUrl", "companyName", "title", "description"]),
      ),
    );
  });

  test("notes IncompleteJobDataError from onRecord as VALIDATION", async () => {
    const bag = extractCtx({
      onRecord: async () => {
        throw new IncompleteJobDataError(["title", "description"]);
      },
    });
    const result = await extract(bag.ctx);
    expect(result.skipped).toBe(true);
    expect(result.invalidStreak).toBe(1);
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.VALIDATION]);
    expect(bag.notices[0].message).toBe(
      cardDecisionLabel(JOB_ID, cardInvalidDecision(["title", "description"])),
    );
  });

  test("treats a duck-typed IncompleteJobDataError the same way", async () => {
    const error = new Error("Skipping job. Missing or invalid required job data: companyName.");
    error.name = "IncompleteJobDataError";
    const bag = extractCtx({
      onRecord: async () => {
        throw error;
      },
    });
    const result = await extract(bag.ctx);
    expect(result.skipped).toBe(true);
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.VALIDATION]);
    expect(bag.notices[0].message).toBe(cardDecisionLabel(JOB_ID, cardInvalidDecision([])));
  });

  test("rethrows an unexpected onRecord error", async () => {
    const bag = extractCtx({
      onRecord: async () => {
        throw new Error("queue down");
      },
    });
    await expect(extract(bag.ctx)).rejects.toThrow("queue down");
    expect(bag.outcomes).toEqual([]);
  });

  test("returns the detail and clears the invalid streak on success", async () => {
    const bag = extractCtx();
    const result = await extract(bag.ctx, { invalidStreak: 3 });
    expect(result.jobId).toBe(JOB_ID);
    expect(result.detailId).toBe(DETAIL_ID);
    expect(result.invalidStreak).toBe(0);
    expect(result.skipped).toBeUndefined();
    expect(result.detail.title).toBe("Staff Engineer");
    expect(bag.activities.some((activity) => activity.label === "Saving record")).toBe(true);
  });

  test("stops the crawl after five extract failures", async () => {
    const bag = extractCtx({
      parseDetail: () => {
        throw new Error("detail DOM collapsed");
      },
    });
    await expect(extract(bag.ctx, { invalidStreak: INVALID_STREAK - 1 })).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: INVALID_STREAK_MESSAGE,
    });
    expect(bag.outcomes).toEqual([SCRAPE_OUTCOMES.FAILED]);
    expect(() => {
      throw new RoutineBlockedError(INVALID_STREAK_MESSAGE);
    }).toThrow(RoutineBlockedError);
  });
});
