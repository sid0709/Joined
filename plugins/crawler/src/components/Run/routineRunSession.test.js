import { describe, expect, test } from "bun:test";

import { createScrapeRunStats } from "../../api/scrapeRunStats";
import { listDeclaredFields } from "../../routineKit/declaredFields";
import { isFound } from "../../routineKit/html.js";
import { parseDetail } from "../../routines/builtin/parseDetail.js";
import "../../routines/builtin/testing/domParser.js";
import { loadFixture } from "../../routines/builtin/testing/loadFixture.js";
import BuiltInRoutine from "../../routines/BuiltInRoutine.js";

import {
  applyActiveQueueSnapshot,
  createRoutineRunSession,
  EMPTY_QUEUE,
  readDeclaredField,
} from "./routineRunSession";
import { fieldRunSummary } from "./runState";

const JOB_URL =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204";

function fakeScrapeQueue() {
  const runs = {};
  const items = [];
  const send = async (message) => {
    if (message.action === "scrapeQueue:clear") {
      const beginRunId = message.payload?.beginRunId;
      items.length = 0;
      for (const key of Object.keys(runs)) delete runs[key];
      if (beginRunId) runs[beginRunId] = { ...createScrapeRunStats(), updatedAt: Date.now() };
      return {
        success: true,
        state: {
          runId: beginRunId,
          counts: { ...EMPTY_QUEUE },
          summary: createScrapeRunStats(),
        },
      };
    }
    if (message.action === "scrapeQueue:enqueue") {
      const { runId, job } = message.payload || {};
      if (!runId || !job) return { success: false, error: "runId and job are required" };
      const id = `q-${items.length + 1}`;
      items.push({ id, runId, job });
      if (!runs[runId]) runs[runId] = { ...createScrapeRunStats(), updatedAt: Date.now() };
      return {
        success: true,
        id,
        state: {
          runId,
          counts: { queued: items.filter((item) => item.runId === runId).length, saving: 0 },
          summary: { ...createScrapeRunStats(), ...runs[runId] },
        },
      };
    }
    return { success: false, error: `unknown action ${message.action}` };
  };
  return { send, items, runs };
}

describe("routineRunSession", () => {
  test("Start then a scraped job updates panel counts and enqueues under the new runId", async () => {
    const queue = fakeScrapeQueue();
    const session = createRoutineRunSession({ send: queue.send });
    const runId = await session.start(BuiltInRoutine);

    expect(runId).toBeTruthy();
    expect(session.snapshot.stats).toEqual(createScrapeRunStats());
    expect(session.snapshot.queueCounts).toEqual(EMPTY_QUEUE);
    expect(
      fieldRunSummary(
        listDeclaredFields(BuiltInRoutine),
        session.snapshot.fieldHits,
        session.snapshot.fieldStates,
      ),
    ).toMatchObject({ found: 0, invalid: 0 });

    expect(
      session.applyQueueState({
        runId: "run-old",
        counts: { queued: 9, saving: 1 },
        summary: { ...createScrapeRunStats(), registered: 48 },
      }),
    ).toBe(false);
    expect(session.snapshot.stats.registered).toBe(0);
    expect(session.snapshot.queueCounts).toEqual(EMPTY_QUEUE);

    const record = parseDetail(loadFixture("detail-signed-in.html"), JOB_URL);
    session.recordFields(record, BuiltInRoutine);

    const summary = fieldRunSummary(
      listDeclaredFields(BuiltInRoutine),
      session.snapshot.fieldHits,
      session.snapshot.fieldStates,
    );
    expect(summary.found).toBeGreaterThan(0);
    expect(session.snapshot.fieldHits.companyName.found).toBe(1);
    expect(session.snapshot.fieldHits.companyWebsite.reads).toBe(1);
    expect(session.snapshot.fieldStates.companyName).toBe("ok");

    const response = await session.submitJob(record, BuiltInRoutine);
    expect(response.id).toBe("q-1");
    expect(session.snapshot.queueCounts).toEqual({ queued: 1, saving: 0 });
    expect(session.snapshot.recentJobs[0]).toMatchObject({
      status: "queued",
      company: "Micron Technology",
    });
    expect(session.enqueued).toHaveLength(1);
    expect(session.enqueued[0].runId).toBe(runId);
    expect(session.enqueued[0].job.applyLink).toBe("https://careers.micron.com/apply/9256204");
    expect(session.enqueued[0].job.company.name).toBe("Micron Technology");
    expect(queue.items[0].runId).toBe(runId);
  });

  test("drops a scrapeQueue snapshot that is not this run", () => {
    expect(applyActiveQueueSnapshot(null, { runId: "run-1" })).toBeNull();
    expect(
      applyActiveQueueSnapshot("run-new", { runId: "run-old", counts: { queued: 2 } }),
    ).toBeNull();
    expect(
      applyActiveQueueSnapshot("run-new", { runId: "run-new", counts: { queued: 1 } }),
    ).toEqual({
      counts: { queued: 1 },
      summary: null,
    });
  });

  test("surfaces a field-check throw instead of aborting the read", () => {
    const result = readDeclaredField(
      "title",
      {
        applyUrl: "https://jobs.example/1",
        title: "Engineer",
        description: "Build.",
        companyName: "Acme",
      },
      true,
      {
        declaredFields: [
          {
            get key() {
              throw new Error("checker exploded");
            },
          },
        ],
      },
    );
    expect(result.valid).toBe(false);
    expect(result.error?.message).toBe("checker exploded");
    expect(isFound("Engineer")).toBe(true);
  });
});
