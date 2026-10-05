import { describe, expect, test } from "bun:test";

import { text } from "./fields.js";
import { defineRoutine } from "./routine.js";
import {
  RoutineFinishedError,
  RoutineStepError,
  RoutineStoppedError,
  runRoutinePass,
} from "./runner.js";
import {
  clearHighlights,
  click,
  highlight,
  ON_MISSING,
  pause,
  waitFor,
  waitGone,
} from "./steps.js";
import { listDetail } from "./strategies.js";

function makeRoutine({ strategy = {}, fields, options } = {}) {
  return defineRoutine({
    id: "test",
    label: "Test",
    version: 1,
    match: { hosts: ["jobs.example"] },
    output: "job",
    options: { highlightFields: false, ...options },
    strategy: listDetail({
      open: [click(".card", { highlight: false })],
      ready: [waitFor(".detail", { timeout: 20, interval: 1 })],
      dismiss: [click(".dismiss", { highlight: false })],
      settle: [clearHighlights()],
      ...strategy,
    }),
    fields: fields ?? { title: text("h1"), "company.name": text(".company") },
  });
}

/** A fake page: answers ops from `answers` and records every op it receives. */
function fakePage(answers = {}) {
  const ops = [];
  const defaults = {
    count: () => ({ count: 1 }),
    click: () => ({ found: true }),
    extract: ({ field }) => ({ found: true, value: `value of ${field.selector}` }),
  };
  const exec = async (op) => {
    ops.push(op);
    const answer = answers[op.op] ?? defaults[op.op];
    return answer ? answer(op) : {};
  };
  return {
    ops,
    exec,
    names: () => ops.map((op) => op.op + (op.selector ? ` ${op.selector}` : "")),
  };
}

describe("runRoutinePass", () => {
  test("opens, reads every field into a nested record, dismisses, and settles", async () => {
    const page = fakePage();
    const progress = [];
    const fieldsSeen = [];
    const activities = [];
    let submitted = null;
    await runRoutinePass(makeRoutine(), {
      exec: page.exec,
      onActivity: (activity) => activities.push(activity),
      onProgress: (percent) => progress.push(percent),
      onField: (path, value, _record, found) => fieldsSeen.push([path, value, found]),
      onRecord: (record) => {
        submitted = record;
      },
    });

    expect(page.names()).toEqual([
      "click .card",
      "count .detail",
      "extract",
      "extract",
      "click .dismiss",
      "clear",
    ]);
    expect(submitted).toEqual({ title: "value of h1", company: { name: "value of .company" } });
    expect(fieldsSeen).toEqual([
      ["title", "value of h1", true],
      ["company.name", "value of .company", true],
    ]);
    expect(activities).toEqual([
      { phase: "open", label: "Click .card", kind: "click" },
      { phase: "ready", label: "Wait for .detail", kind: "waitFor" },
      { phase: "read", label: "Reading title", field: "title" },
      { phase: "read", label: "Reading company name", field: "company.name" },
      { phase: "submit", label: "Saving record" },
      { phase: "dismiss", label: "Click .dismiss", kind: "click" },
      { phase: "settle", label: "Clear highlights", kind: "clear" },
    ]);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(100);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  test("outlines each field while reading it when highlightFields is on", async () => {
    const page = fakePage();
    const routine = makeRoutine({
      options: { highlightFields: true, fieldPauseMs: 1 },
      fields: { title: text("h1") },
    });
    await runRoutinePass(routine, { exec: page.exec });
    expect(page.names()).toContain("highlight h1");
    expect(page.names().slice(2, 5)).toEqual(["highlight h1", "extract", "clear"]);
  });

  test("still dismisses a rejected record, then reports the rejection", async () => {
    const page = fakePage();
    const rejection = new Error("incomplete");
    const pass = runRoutinePass(makeRoutine(), {
      exec: page.exec,
      onRecord: () => {
        throw rejection;
      },
    });
    await expect(pass).rejects.toBe(rejection);
    expect(page.names()).toContain("click .dismiss");
    expect(page.names()).not.toContain("clear");
  });

  test("fails, skips, or finishes when a clicked element is missing", async () => {
    const missing = () => fakePage({ click: () => ({ found: false }) });

    await expect(runRoutinePass(makeRoutine(), { exec: missing().exec })).rejects.toBeInstanceOf(
      RoutineStepError,
    );

    const finishing = makeRoutine({
      strategy: { open: [click(".card", { onMissing: ON_MISSING.FINISH, highlight: false })] },
    });
    await expect(runRoutinePass(finishing, { exec: missing().exec })).rejects.toBeInstanceOf(
      RoutineFinishedError,
    );

    const skipping = makeRoutine({
      strategy: {
        open: [click(".card", { onMissing: ON_MISSING.SKIP })],
        dismiss: [click([".a", ".b"], { onMissing: ON_MISSING.SKIP, highlight: false })],
      },
    });
    const page = missing();
    await runRoutinePass(skipping, { exec: page.exec });
    expect(page.names().slice(0, 2)).toEqual(["highlight .card", "click .card"]);
  });

  test("waitFor fails when the element never appears", async () => {
    const page = fakePage({ count: () => ({ count: 0 }) });
    await expect(runRoutinePass(makeRoutine(), { exec: page.exec })).rejects.toThrow(
      "No element matches .detail",
    );
  });

  test("waitGone reports whether the element went away", async () => {
    const notices = [];
    let detailOpen = 2;
    const page = fakePage({ count: () => ({ count: detailOpen-- > 0 ? 1 : 0 }) });
    const routine = makeRoutine({
      strategy: {
        ready: [],
        dismiss: [
          waitGone(".detail", { timeout: 1000, interval: 1, notice: "Closing" }),
          waitGone(".stuck", { timeout: 5, interval: 1, notice: "Stuck" }),
          waitGone(".quiet", { timeout: 0 }),
        ],
      },
    });
    await runRoutinePass(routine, {
      exec: async (op) => (op.selector === ".stuck" ? { count: 1 } : page.exec(op)),
      onNotice: (message, ok) => notices.push([message, ok]),
    });
    expect(notices).toEqual([
      ["Closing: done", true],
      ["Stuck: timed out", false],
    ]);
  });

  test("stops when the signal is aborted, before or during a pass", async () => {
    const before = new AbortController();
    before.abort();
    await expect(
      runRoutinePass(makeRoutine(), { exec: fakePage().exec, signal: before.signal }),
    ).rejects.toBeInstanceOf(RoutineStoppedError);

    const during = new AbortController();
    const page = fakePage({
      extract: () => {
        during.abort();
        return { value: "" };
      },
    });
    const pass = runRoutinePass(makeRoutine(), {
      exec: page.exec,
      signal: during.signal,
      onRecord: () => {
        throw new Error("never reached");
      },
    });
    await expect(pass).rejects.toBeInstanceOf(RoutineStoppedError);
    expect(page.names()).not.toContain("click .dismiss");

    const pausing = new AbortController();
    const paused = makeRoutine({ strategy: { open: [pause(5)] } });
    const pausedPass = runRoutinePass(paused, { exec: fakePage().exec, signal: pausing.signal });
    pausing.abort();
    await expect(pausedPass).rejects.toBeInstanceOf(RoutineStoppedError);
  });

  test("gives up on a page that never answers", async () => {
    const pass = runRoutinePass(makeRoutine({ strategy: { open: [highlight(".card")] } }), {
      exec: () => new Promise(() => {}),
      opTimeoutMs: 5,
    });
    await expect(pass).rejects.toThrow('Page op "highlight" timed out after 5 ms');
  });

  test("rejects a pass it cannot run", async () => {
    const routine = makeRoutine();
    await expect(runRoutinePass(routine, {})).rejects.toThrow("needs hooks.exec");
    const unknown = { ...routine, strategy: { kind: "teleport" } };
    await expect(runRoutinePass(unknown, { exec: fakePage().exec })).rejects.toThrow(
      "Unsupported strategy: teleport",
    );
  });
});
