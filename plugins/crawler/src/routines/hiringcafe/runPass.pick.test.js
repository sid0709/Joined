import { describe, expect, test } from "bun:test";

import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats.js";

import { CARD_SKIP_ALREADY_APPLIED } from "./constants.js";
import { pickNextJob } from "./runPass.js";

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
