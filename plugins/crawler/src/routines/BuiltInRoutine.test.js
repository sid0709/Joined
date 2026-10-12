import { describe, expect, test } from "bun:test";

import { findRoutineForUrl } from "../routineKit/match.js";
import { RoutineFinishedError, RoutineStoppedError, runRoutinePass } from "../routineKit/runner.js";

import "./builtin/testing/domParser.js";
import { HANDLED_STORAGE_KEY } from "./builtin/constants.js";
import { jobSaveSelector } from "./builtin/cssEscape.js";
import { createBuiltinStore, memoryStorage } from "./builtin/store.js";
import { loadFixture } from "./builtin/testing/loadFixture.js";
import BuiltInRoutine from "./BuiltInRoutine.js";

import { ROUTINES } from "./index.js";

const LIST_URL = "https://builtin.com/jobs";
const JOB_A =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204";
const JOB_B =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/11111111";

const routine = { ...BuiltInRoutine, options: { ...BuiltInRoutine.options, fieldPauseMs: 0 } };

function builtinExec({
  listHtml = loadFixture("list.html"),
  listUrl = LIST_URL,
  details = {
    [JOB_A]: loadFixture("detail-external.html"),
    [JOB_B]: loadFixture("detail-signed-in.html"),
  },
  paginatedListHtml,
} = {}) {
  const clicks = [];
  const fetches = [];
  const exec = async (op) => {
    if (op.op === "html") return { html: listHtml, url: listUrl };
    if (op.op === "fetch") {
      fetches.push(op.url);
      const html = details[op.url];
      if (html == null) {
        const isList = /\/jobs/.test(op.url) && !/\/job\//.test(op.url);
        return {
          html: isList ? (paginatedListHtml ?? loadFixture("list-empty.html")) : "",
          url: op.url,
          status: 200,
        };
      }
      return { html, url: op.url, status: 200 };
    }
    if (op.op === "click") {
      clicks.push(op.selector);
      return { found: true };
    }
    return {};
  };
  return { exec, clicks, fetches };
}

async function collectPass(store, exec, extra = {}) {
  const records = [];
  await runRoutinePass(routine, {
    exec,
    store,
    skipDelays: true,
    onRecord: (record) => records.push(record),
    ...extra,
  });
  return records;
}

describe("BuiltInRoutine", () => {
  test("is registered for builtin.com and www.builtin.com", () => {
    expect(findRoutineForUrl(ROUTINES, "https://builtin.com/jobs")).toBe(BuiltInRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://www.builtin.com/job/x/1")).toBe(BuiltInRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://jobright.ai/jobs")).not.toBe(BuiltInRoutine);
  });

  test("fetches a job and reads the ingest shape, including Easy Apply vs external apply URLs", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinExec({
      details: { [JOB_A]: loadFixture("detail-easyapply.html") },
    });
    const [easy] = await collectPass(store, page.exec);
    expect(easy.title).toContain("Specialist Account Executive");
    expect(easy.applyLink).toBe(JOB_A);
    expect(easy.tags).toContain("Easy Apply");
    expect(easy.details.salary).toBe("113K-162K Annually");
    expect(easy.company.name).toBe("Zscaler");
    expect(page.fetches).toContain(JOB_A);

    const store2 = createBuiltinStore(memoryStorage());
    const signed = builtinExec({
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
    });
    const [external] = await collectPass(store2, signed.exec);
    expect(external.applyLink).toBe("https://careers.micron.com/apply/9256204");
    expect(external.tags).not.toContain("Easy Apply");
    expect(signed.clicks).toContain(jobSaveSelector("9256204"));
    expect([...(await store2.loadHandledIds())]).toContain("9256204");
  });

  test("does not mark handled or Save when enqueue fails", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinExec();
    await expect(
      collectPass(store, page.exec, {
        onRecord: () => {
          throw new Error("enqueue failed");
        },
      }),
    ).rejects.toThrow("enqueue failed");
    expect([...(await store.loadHandledIds())]).toEqual([]);
    expect(page.clicks).toEqual([]);
  });

  test("skips handled IDs and Saved cards, then finishes when the lists are empty", async () => {
    const storage = memoryStorage({
      [HANDLED_STORAGE_KEY]: { 9256204: Date.now() },
    });
    const store = createBuiltinStore(storage);
    const page = builtinExec({
      listHtml: loadFixture("list.html"),
      details: {
        [JOB_A]: loadFixture("detail-external.html"),
        [JOB_B]: loadFixture("detail-easyapply.html"),
      },
    });
    const [first] = await collectPass(store, page.exec);
    expect(page.fetches).toContain(JOB_B);
    expect(page.fetches).not.toContain(JOB_A);
    expect(first.tags).toContain("Easy Apply");

    const savedPage = builtinExec({ listHtml: loadFixture("list-saved.html") });
    const savedStore = createBuiltinStore(memoryStorage());
    await expect(collectPass(savedStore, savedPage.exec)).rejects.toBeInstanceOf(
      RoutineFinishedError,
    );

    const empty = builtinExec({ listHtml: loadFixture("list-empty.html") });
    await expect(
      collectPass(createBuiltinStore(memoryStorage()), empty.exec),
    ).rejects.toBeInstanceOf(RoutineFinishedError);
  });

  test("resumes from a stored cursor and honours Stop", async () => {
    const store = createBuiltinStore(memoryStorage());
    await store.saveCursor({
      listIndex: 0,
      page: 1,
      lastJobId: "9256204",
      lists: [LIST_URL],
    });
    const page = builtinExec();
    const [record] = await collectPass(store, page.exec);
    expect(record.title).toContain("Staff/ Principal Engineer");
    expect(page.fetches).toContain(JOB_B);
    expect(page.fetches).not.toContain(JOB_A);

    const stopper = new AbortController();
    stopper.abort();
    await expect(
      runRoutinePass(routine, {
        exec: builtinExec().exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
        signal: stopper.signal,
      }),
    ).rejects.toBeInstanceOf(RoutineStoppedError);
  });

  test("processes the page when lastJobId is no longer on it", async () => {
    const store = createBuiltinStore(memoryStorage());
    await store.saveCursor({
      listIndex: 0,
      page: 1,
      lastJobId: "gone",
      lastPageIds: "",
      lists: [LIST_URL],
    });
    const page = builtinExec();
    const [record] = await collectPass(store, page.exec);
    expect(page.fetches).toContain(JOB_A);
    expect(page.fetches).not.toContain(JOB_B);
    expect(record.title).toContain("Staff/ Principal Engineer");
  });

  test("stops a list when the next page repeats the same card IDs", async () => {
    const now = Date.now();
    const store = createBuiltinStore(
      memoryStorage({
        [HANDLED_STORAGE_KEY]: { 9256204: now, 11111111: now },
      }),
    );
    await store.saveCursor({
      listIndex: 0,
      page: 1,
      lastJobId: "",
      lastPageIds: "",
      lists: [LIST_URL],
    });
    const listHtml = loadFixture("list.html");
    const page = builtinExec({ listHtml, paginatedListHtml: listHtml });
    await expect(collectPass(store, page.exec)).rejects.toBeInstanceOf(RoutineFinishedError);
    expect(page.fetches.some((url) => String(url).includes("page=2"))).toBe(true);
    expect(page.fetches.some((url) => String(url).includes("page=3"))).toBe(false);
  });
});
