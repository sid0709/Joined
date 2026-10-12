import { describe, expect, test } from "bun:test";

import { findRoutineForUrl } from "../routineKit/match.js";
import { listDeclaredFields } from "../routineKit/routine.js";
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
  try {
    await runRoutinePass(routine, {
      exec,
      store,
      skipDelays: true,
      onRecord: (record) => records.push(record),
      ...extra,
    });
  } catch (error) {
    if (!(error instanceof RoutineFinishedError)) throw error;
  }
  return records;
}

describe("BuiltInRoutine", () => {
  test("is registered for builtin.com and www.builtin.com", () => {
    expect(findRoutineForUrl(ROUTINES, "https://builtin.com/jobs")).toBe(BuiltInRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://www.builtin.com/job/x/1")).toBe(BuiltInRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://jobright.ai/jobs")).not.toBe(BuiltInRoutine);
    const keys = listDeclaredFields(BuiltInRoutine).map((field) => field.key);
    expect(keys).not.toContain("skills");
    expect(keys).not.toContain("companyWebsite");
    expect(BuiltInRoutine.runView.settings).toContain("concurrency");
    expect(BuiltInRoutine.runView.components).toContain("pace");
  });

  test("fetches a job and reads the ingest shape, including Easy Apply vs external apply URLs", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinExec({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-easyapply.html") },
    });
    const records = await collectPass(store, page.exec);
    const easy = records.find((record) => record.badges?.includes("Easy Apply"));
    expect(easy.title).toContain("Specialist Account Executive");
    expect(easy.applyUrl).toBe(JOB_A);
    expect(easy.badges).toContain("Easy Apply");
    expect(easy.salary).toBe("113K-162K Annually");
    expect(easy.companyName).toBe("Zscaler");
    expect(page.fetches).toContain(JOB_A);

    const store2 = createBuiltinStore(memoryStorage());
    const signed = builtinExec({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
    });
    const signedRecords = await collectPass(store2, signed.exec);
    const external = signedRecords.find((record) =>
      String(record.applyUrl).includes("careers.micron.com"),
    );
    expect(external.applyUrl).toBe("https://careers.micron.com/apply/9256204");
    expect(external.badges).not.toContain("Easy Apply");
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
    const firstRecords = await collectPass(store, page.exec);
    const first = firstRecords.find((record) => record.badges?.includes("Easy Apply"));
    expect(page.fetches).toContain(JOB_B);
    expect(page.fetches).not.toContain(JOB_A);
    expect(first.badges).toContain("Easy Apply");

    const savedPage = builtinExec({ listHtml: loadFixture("list-saved.html") });
    const savedStore = createBuiltinStore(memoryStorage());
    expect(await collectPass(savedStore, savedPage.exec)).toEqual([]);

    const empty = builtinExec({ listHtml: loadFixture("list-empty.html") });
    expect(await collectPass(createBuiltinStore(memoryStorage()), empty.exec)).toEqual([]);
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
    const records = await collectPass(store, page.exec);
    expect(records.some((record) => record.title.includes("Staff/ Principal Engineer"))).toBe(true);
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
    const records = await collectPass(store, page.exec);
    expect(page.fetches).toContain(JOB_A);
    expect(page.fetches).toContain(JOB_B);
    expect(records.some((record) => record.title.includes("Staff/ Principal Engineer"))).toBe(true);
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
    expect(await collectPass(store, page.exec)).toEqual([]);
    expect(page.fetches.some((url) => String(url).includes("page=2"))).toBe(true);
    expect(page.fetches.some((url) => String(url).includes("page=3"))).toBe(false);
  });
});
