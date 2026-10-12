import { describe, expect, test } from "bun:test";

import { CORE_JOB_FIELD_KEYS } from "../routineKit/declaredFields.js";
import { findRoutineForUrl } from "../routineKit/match.js";
import { listDeclaredFields } from "../routineKit/routine.js";
import { RoutineFinishedError, RoutineStoppedError, runRoutinePass } from "../routineKit/runner.js";

import BuiltInRoutine from "./BuiltInRoutine.js";
import { CHALLENGE_WAIT_LABEL, START_FROM_PAGE_ONE_LABEL } from "./hiringcafe/constants.js";
import { createHiringCafeStore, memoryStorage } from "./hiringcafe/store.js";
import {
  detailJob,
  detailPageHtml,
  groupedHits,
  listPageHtml,
} from "./hiringcafe/testing/pageHtml.js";
import HiringCafeRoutine from "./HiringCafeRoutine.js";

import { ROUTINES } from "./index.js";
import "./hiringcafe/testing/domParser.js";

const LIST_URL = "https://hiringcafe.com/classic";
const routine = {
  ...HiringCafeRoutine,
  options: { ...HiringCafeRoutine.options, fieldPauseMs: 0 },
};

function jobUrl(id, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://hiringcafe.com/job/${slug}-${id}`;
}

function hiringCafeTab({
  listHtml = listPageHtml(),
  listUrl = LIST_URL,
  details,
  paginatedListHtml,
  blockOnce = null,
  blockWhen = null,
  challengeOnce = false,
  timeoutOnce = null,
} = {}) {
  let url = listUrl;
  let status = 200;
  let htmlOverride = null;
  let remainingChallenge = challengeOnce ? 3 : 0;
  const navigates = [];
  const fetches = [];
  const defaultDetails = Object.fromEntries(
    groupedHits().map((hit) => {
      const href = jobUrl(hit.requisition_id, hit.job_information.title);
      return [
        href,
        detailPageHtml({
          job: detailJob({
            ...hit,
            apply_url: hit.apply_url,
            job_information: {
              ...hit.job_information,
              description: `<p>Description for ${hit.job_information.title}</p>`,
            },
          }),
        }),
      ];
    }),
  );
  const pages = details ?? defaultDetails;
  const pageFor = (href) => {
    if (pages[href]) return { html: pages[href], url: href };
    const isList = /\/classic/.test(href);
    if (isList && /[?&]page=/.test(href)) {
      return {
        html: paginatedListHtml ?? listPageHtml({ hits: [], ssrPage: 1, ssrIsLastPage: true }),
        url: href,
      };
    }
    if (isList) return { html: listHtml, url: href };
    return { html: "", url: href };
  };
  const exec = async (op) => {
    if (op.op === "html") {
      if (remainingChallenge > 0) {
        remainingChallenge -= 1;
        return {
          html: "<html><body>Just a moment... Verify you are human<div class='cf-turnstile'></div></body></html>",
          url,
          status: 403,
        };
      }
      return { html: htmlOverride ?? pageFor(url).html, url, status };
    }
    if (op.op === "fetch") {
      fetches.push(op.url);
      throw new Error("HiringCafe must not background-fetch");
    }
    if (op.op === "navigate") {
      navigates.push(op.url);
      if (timeoutOnce && timeoutOnce(op.url)) {
        timeoutOnce = null;
        throw new Error('Page op "navigate" timed out after 15 ms');
      }
      url = op.url;
      if (blockWhen?.(op.url)) {
        status = 403;
        htmlOverride = "access denied";
      } else if (blockOnce && blockOnce(op.url)) {
        status = 403;
        htmlOverride = "access denied";
        blockOnce = null;
      } else {
        status = 200;
        htmlOverride = null;
      }
      return { url, status };
    }
    if (op.op === "highlight" || op.op === "clear") return {};
    return {};
  };
  return { exec, navigates, fetches };
}

async function collectJobs(store, exec, extra = {}) {
  const { onRecord, ...hooks } = extra;
  const records = [];
  try {
    for (;;) {
      await runRoutinePass(routine, {
        exec,
        store,
        skipDelays: true,
        onRecord: onRecord ?? ((record) => records.push(record)),
        ...hooks,
      });
    }
  } catch (error) {
    if (!(error instanceof RoutineFinishedError)) throw error;
  }
  return records;
}

describe("HiringCafeRoutine", () => {
  test("is registered for hiringcafe.com and declared in the Run panel", () => {
    expect(findRoutineForUrl(ROUTINES, "https://hiringcafe.com/classic")).toBe(HiringCafeRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://www.hiringcafe.com/job/x-abc")).toBe(
      HiringCafeRoutine,
    );
    expect(findRoutineForUrl(ROUTINES, "https://hiring.cafe/classic")).toBe(HiringCafeRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://builtin.com/jobs")).toBe(BuiltInRoutine);
    const keys = listDeclaredFields(HiringCafeRoutine).map((field) => field.key);
    for (const key of CORE_JOB_FIELD_KEYS) {
      expect(keys).toContain(key);
    }
    expect(keys).toContain("postedAtSource");
    expect(keys).toContain("companyWebsite");
    expect(keys).toContain("companyProfileUrl");
    expect(HiringCafeRoutine.runView.stats).toContain("cursor");
    expect(HiringCafeRoutine.runView.stats).toContain("outcomes");
    expect(HiringCafeRoutine.runView.components).toContain("fieldGroups");
    expect(HiringCafeRoutine.options.allowFetch).toBe(false);
    expect(HiringCafeRoutine.resume.resetLabel).toBe(START_FROM_PAGE_ONE_LABEL);
  });

  test("opens every grouped ssrHits posting, not just the two cards", async () => {
    const page = hiringCafeTab();
    const records = await collectJobs(createHiringCafeStore(memoryStorage()), page.exec);
    expect(records).toHaveLength(4);
    expect(records.map((record) => record.requisitionId).sort()).toEqual([
      "reqaaa1111111111",
      "reqbbb2222222222",
      "reqccc3333333333",
      "reqddd4444444444",
    ]);
    expect(page.navigates.filter((url) => /\/job\//.test(url))).toHaveLength(4);
    expect(page.fetches).toEqual([]);
  });

  test("resumes from a stored page and job cursor, honours Stop, and resets to page 1", async () => {
    const store = createHiringCafeStore(memoryStorage());
    await store.saveCursor({
      listIndex: 0,
      page: 0,
      lastJobId: "reqaaa1111111111",
      lists: [LIST_URL],
    });
    expect(await HiringCafeRoutine.resume.loadLabel(store)).toBe(
      "Resume from page 1 · reqaaa1111111111",
    );
    const page = hiringCafeTab();
    const records = await collectJobs(store, page.exec);
    expect(records.map((record) => record.requisitionId)).not.toContain("reqaaa1111111111");
    expect(records.length).toBe(3);

    await HiringCafeRoutine.resume.reset(store);
    expect(await store.loadCursor()).toBeNull();
    expect(await HiringCafeRoutine.resume.loadLabel(store)).toBe("");

    const stopper = new AbortController();
    stopper.abort();
    await expect(
      runRoutinePass(routine, {
        exec: hiringCafeTab().exec,
        store: createHiringCafeStore(memoryStorage()),
        skipDelays: true,
        signal: stopper.signal,
      }),
    ).rejects.toBeInstanceOf(RoutineStoppedError);
  });

  test("retries a hung navigation and backs off a 403 without stopping", async () => {
    const firstUrl = jobUrl("reqaaa1111111111", "Help Desk Coordinator");
    const store = createHiringCafeStore(memoryStorage());
    const page = hiringCafeTab({
      timeoutOnce: (url) => url === firstUrl,
      blockOnce: (url) => url === firstUrl,
    });
    const records = await collectJobs(store, page.exec);
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(page.navigates.filter((url) => url === firstUrl).length).toBeGreaterThan(1);
    expect(page.fetches).toEqual([]);
  });

  test("waits for the user when Cloudflare Turnstile is showing", async () => {
    const activities = [];
    const page = hiringCafeTab({ challengeOnce: true });
    const records = await collectJobs(createHiringCafeStore(memoryStorage()), page.exec, {
      onActivity: (activity) => activities.push(activity),
    });
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(activities.some((activity) => activity.label === CHALLENGE_WAIT_LABEL)).toBe(true);
  });

  test("skips already-handled requisition ids on a later run", async () => {
    const store = createHiringCafeStore(memoryStorage());
    await store.markHandled("reqaaa1111111111", new Set());
    await store.markHandled("reqbbb2222222222", new Set());
    const outcomes = [];
    const records = await collectJobs(store, hiringCafeTab().exec, {
      recordOutcome: (outcome) => outcomes.push(outcome),
    });
    expect(records.map((record) => record.requisitionId).sort()).toEqual([
      "reqccc3333333333",
      "reqddd4444444444",
    ]);
    expect(outcomes.filter((outcome) => outcome === "duplicate").length).toBeGreaterThanOrEqual(2);
  });
});
