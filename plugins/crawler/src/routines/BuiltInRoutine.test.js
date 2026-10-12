import { describe, expect, test } from "bun:test";

import { findRoutineForUrl } from "../routineKit/match.js";
import { listDeclaredFields } from "../routineKit/routine.js";
import {
  RoutineBlockedError,
  RoutineFinishedError,
  RoutineStoppedError,
  runRoutinePass,
} from "../routineKit/runner.js";

import "./builtin/testing/domParser.js";
import {
  CARD_DECISION_OPENED,
  CARD_SKIP_HANDLED,
  CARD_SKIP_HEART_SAVED,
  HANDLED_STORAGE_KEY,
  HEART_NOT_SAVED_LABEL,
  HEART_UNREAD_LABEL,
  JOB_CARD_TITLE,
  JOB_PAGE_SAVE,
  SIGN_IN_TO_SAVE_MESSAGE,
  SIGN_UP_MODAL_TEXT,
  STUCK_LOGIN_MESSAGE,
  STUCK_PAGE_FAILURES,
  cardDecisionLabel,
  cardInvalidDecision,
  stuckPageMessage,
} from "./builtin/constants.js";
import { entityIdFromSaveHost, jobSaveSelector } from "./builtin/cssEscape.js";
import { createBuiltinStore, memoryStorage } from "./builtin/store.js";
import { loadFixture } from "./builtin/testing/loadFixture.js";
import BuiltInRoutine from "./BuiltInRoutine.js";
import JobRightRoutine from "./JobRightRoutine.js";

import { ROUTINES } from "./index.js";

const LIST_URL = "https://builtin.com/jobs";
const JOB_A =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204";
const JOB_B =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/11111111";
const JOB_SAVED =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/22222222";
const JOB_HPE = "https://builtin.com/job/software-development-engineer-test/11623103";

const routine = { ...BuiltInRoutine, options: { ...BuiltInRoutine.options, fieldPauseMs: 0 } };

function builtinTab({
  listHtml = loadFixture("list.html"),
  listUrl = LIST_URL,
  details = {
    [JOB_A]: loadFixture("detail-external.html"),
    [JOB_B]: loadFixture("detail-signed-in.html"),
  },
  paginatedListHtml,
  hearts = {},
  shadowFound = true,
  blockOnce = null,
  blockWhen = null,
  timeoutOnce = null,
  timeoutWhen = null,
  loginWall = false,
  delayedReady = {},
  heartStaysUnsaved = false,
  heartShowsModal = false,
} = {}) {
  let url = listUrl;
  let status = 200;
  let htmlOverride = null;
  const clicks = [];
  const navigates = [];
  const fetches = [];
  const shadows = [];
  const heartsState = { ...hearts };
  const pageFor = (href) => {
    if (details[href]) return { html: details[href], url: href };
    const isList = /\/jobs/.test(href) && !/\/job\//.test(href);
    if (isList && /[?&]page=/.test(href)) {
      return { html: paginatedListHtml ?? loadFixture("list-empty.html"), url: href };
    }
    if (isList) return { html: listHtml, url: href };
    return { html: "", url: href };
  };
  const exec = async (op) => {
    if (op.op === "html") {
      if (loginWall) {
        return {
          html: "<html><body>Sign in</body></html>",
          url: "https://builtin.com/auth/login",
          status: 200,
        };
      }
      const remaining = delayedReady[url];
      if (Number(remaining) > 0) {
        delayedReady[url] = remaining - 1;
        return { html: "<html><body><p>loading</p></body></html>", url, status };
      }
      return {
        html: htmlOverride ?? pageFor(url).html,
        url,
        status,
      };
    }
    if (op.op === "fetch") {
      fetches.push(op.url);
      throw new Error("Built In must not background-fetch");
    }
    if (op.op === "navigate") {
      navigates.push(op.url);
      if (timeoutWhen?.(op.url)) {
        throw new Error('Page op "navigate" timed out after 15 ms');
      }
      if (timeoutOnce && timeoutOnce(op.url)) {
        timeoutOnce = null;
        throw new Error('Page op "navigate" timed out after 15 ms');
      }
      url = loginWall ? "https://builtin.com/auth/login" : op.url;
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
    if (op.op === "click") {
      clicks.push(op.selector);
      return { found: true };
    }
    if (op.op === "shadow") {
      shadows.push({ host: op.host, action: op.action });
      const id = entityIdFromSaveHost(op.host);
      if (!shadowFound) return { found: false, open: false, classes: "", prefix: "" };
      if (op.action === "click" && id && !heartStaysUnsaved) heartsState[id] = true;
      if (op.action === "click" && heartShowsModal) {
        htmlOverride = `${pageFor(url).html}<dialog>${SIGN_UP_MODAL_TEXT}</dialog>`;
      }
      const saved = Boolean(id && heartsState[id]);
      return {
        found: true,
        open: true,
        classes: saved ? "heart saved" : "heart",
        prefix: saved ? "fas" : "far",
      };
    }
    return {};
  };
  return { exec, clicks, navigates, fetches, shadows };
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

describe("BuiltInRoutine", () => {
  test("is registered for builtin.com and declares no skills or pace settings", () => {
    expect(findRoutineForUrl(ROUTINES, "https://builtin.com/jobs")).toBe(BuiltInRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://www.builtin.com/job/x/1")).toBe(BuiltInRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://jobright.ai/jobs")).not.toBe(BuiltInRoutine);
    const keys = listDeclaredFields(BuiltInRoutine).map((field) => field.key);
    expect(keys).not.toContain("skills");
    expect(keys).not.toContain("companyWebsite");
    expect(BuiltInRoutine.runView.settings).toEqual([]);
    expect(BuiltInRoutine.runView.components).not.toContain("pace");
    expect(BuiltInRoutine.runView.stats).toContain("cursor");
    expect(BuiltInRoutine.runView.stats).toContain("blocks");
    expect(BuiltInRoutine.options.allowFetch).toBe(false);
    expect(BuiltInRoutine.version).toBe(3);
  });

  test("navigates the same tab, reads the ingest shape, and never background-fetches", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-easyapply.html") },
    });
    const records = await collectJobs(store, page.exec);
    const easy = records.find((record) => record.badges?.includes("Easy Apply"));
    expect(easy.title).toContain("Specialist Account Executive");
    expect(easy.applyUrl).toBe(JOB_A);
    expect(easy.companyName).toBe("Zscaler");
    expect(easy.salary).toBe("113K-162K Annually");
    expect(page.navigates).toContain(JOB_A);
    expect(page.navigates).toContain(LIST_URL);
    expect(page.fetches).toEqual([]);
    expect(page.clicks.some((selector) => selector === JOB_CARD_TITLE)).toBe(false);
    expect(page.clicks.some((selector) => String(selector).includes("heart-button"))).toBe(false);
    expect(page.clicks).not.toContain(JOB_PAGE_SAVE);
  });

  test("clicks the list-card heart only after a successful enqueue", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
    });
    const records = await collectJobs(store, page.exec);
    expect(records[0].applyUrl).toBe("https://careers.micron.com/apply/9256204");
    expect(page.shadows.some((op) => op.action === "click")).toBe(true);
    expect(page.shadows.some((op) => op.host === jobSaveSelector("9256204"))).toBe(true);
    expect([...(await store.loadHandledIds())]).toContain("9256204");

    const failing = builtinTab({ listHtml: loadFixture("list-last.html") });
    const failedStore = createBuiltinStore(memoryStorage());
    await expect(
      collectJobs(failedStore, failing.exec, {
        onRecord: () => {
          throw new Error("enqueue failed");
        },
      }),
    ).rejects.toThrow("enqueue failed");
    expect([...(await failedStore.loadHandledIds())]).toEqual([]);
    expect(failing.shadows.some((op) => op.action === "click")).toBe(false);
  });

  test("opens jobs when live Alpine hides Saved spans with display:none", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinTab({
      listHtml: loadFixture("list.html"),
      details: {
        [JOB_A]: loadFixture("detail-external.html"),
        [JOB_B]: loadFixture("detail-easyapply.html"),
      },
    });
    const activities = [];
    const records = await collectJobs(store, page.exec, {
      onActivity: (activity) => activities.push(activity),
    });
    expect(page.navigates).toContain(JOB_A);
    expect(page.navigates).toContain(JOB_B);
    expect(records.length).toBeGreaterThan(0);
    expect(
      activities.some(
        (activity) => activity.label === cardDecisionLabel("9256204", CARD_DECISION_OPENED),
      ),
    ).toBe(true);
    expect(
      activities.some(
        (activity) => activity.label === cardDecisionLabel("11111111", CARD_DECISION_OPENED),
      ),
    ).toBe(true);
  });

  test("does not skip a card because a Saved span is in the HTML", async () => {
    const page = builtinTab({
      listHtml: loadFixture("list-saved.html"),
      details: { [JOB_SAVED]: loadFixture("detail-easyapply.html") },
    });
    const records = await collectJobs(createBuiltinStore(memoryStorage()), page.exec);
    expect(page.navigates).toContain(JOB_SAVED);
    expect(records).toHaveLength(1);
  });

  test("waits for jobPostInit on an HPE job and stores an absolute applyUrl", async () => {
    const page = builtinTab({
      listHtml: loadFixture("list-last.html")
        .replaceAll("9256204", "11623103")
        .replaceAll(
          "/job/staff-principal-engineer-oct-mte-material-engineering/11623103",
          "/job/software-development-engineer-test/11623103",
        ),
      details: { [JOB_HPE]: loadFixture("detail-hpe.html") },
      delayedReady: { [JOB_HPE]: 2 },
    });
    const records = await collectJobs(createBuiltinStore(memoryStorage()), page.exec);
    expect(records).toHaveLength(1);
    expect(records[0].applyUrl).toBe(JOB_HPE);
    expect(records[0].companyName).toBe("Hewlett Packard Enterprise");
    expect(page.navigates.filter((url) => url === JOB_HPE).length).toBe(1);
  });

  test("skips a card that is still incomplete after the ready wait without striking the page", async () => {
    const page = builtinTab({
      listHtml: loadFixture("list.html"),
      details: {
        [JOB_A]: "<html><body><p>loading</p></body></html>",
        [JOB_B]: loadFixture("detail-easyapply.html"),
      },
    });
    const activities = [];
    const records = await collectJobs(createBuiltinStore(memoryStorage()), page.exec, {
      onActivity: (activity) => activities.push(activity),
    });
    expect(records).toHaveLength(1);
    expect(page.navigates).toContain(JOB_A);
    expect(page.navigates).toContain(JOB_B);
    expect(
      activities.some(
        (activity) =>
          activity.label ===
          cardDecisionLabel(
            "9256204",
            cardInvalidDecision(["companyName", "title", "description"]),
          ),
      ),
    ).toBe(true);
    expect(records[0].title).toContain("Specialist Account Executive");
  });

  test("stops before hearting when Built In is signed out", async () => {
    const page = builtinTab({
      listHtml: loadFixture("list-last.html").replace('"isLoggedIn":true', '"isLoggedIn":false'),
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
    });
    await expect(
      runRoutinePass(routine, {
        exec: page.exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
        onRecord: () => {},
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: SIGN_IN_TO_SAVE_MESSAGE,
    });
    expect(page.navigates.some((href) => /\/job\//.test(href))).toBe(false);
    expect(page.shadows.some((op) => op.action === "click")).toBe(false);
  });

  test("stops on a header login link before opening jobs", async () => {
    const page = builtinTab({
      listHtml: `${loadFixture("list-last.html")}<header><a href="/auth/login">Sign In</a></header>`,
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
    });
    await expect(
      runRoutinePass(routine, {
        exec: page.exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
        onRecord: () => {},
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: SIGN_IN_TO_SAVE_MESSAGE,
    });
    expect(page.navigates.some((href) => /\/job\//.test(href))).toBe(false);
  });

  test("logs heart not saved and continues the crawl", async () => {
    const activities = [];
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
      heartStaysUnsaved: true,
    });
    const records = await collectJobs(createBuiltinStore(memoryStorage()), page.exec, {
      onActivity: (activity) => activities.push(activity),
    });
    expect(records).toHaveLength(1);
    expect(activities.some((activity) => activity.label === HEART_NOT_SAVED_LABEL)).toBe(true);
    expect(page.shadows.some((op) => op.action === "click")).toBe(true);
  });

  test("stops when a heart click opens the sign-up modal", async () => {
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
      heartStaysUnsaved: true,
      heartShowsModal: true,
    });
    await expect(
      runRoutinePass(routine, {
        exec: page.exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
        onRecord: () => {},
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: SIGN_IN_TO_SAVE_MESSAGE,
    });
    expect(page.shadows.some((op) => op.action === "click")).toBe(true);
  });

  test("does not click the heart when the shadow state cannot be read", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-signed-in.html") },
      shadowFound: false,
    });
    const activities = [];
    const records = await collectJobs(store, page.exec, {
      onActivity: (activity) => activities.push(activity),
    });
    expect(records).toHaveLength(1);
    expect(page.shadows.some((op) => op.action === "click")).toBe(false);
    expect(page.clicks).toEqual([]);
    expect(activities.some((activity) => activity.label?.startsWith(HEART_UNREAD_LABEL))).toBe(
      true,
    );
    expect([...(await store.loadHandledIds())]).toContain("9256204");
  });

  test("skips handled IDs and already-saved hearts, then finishes when next page is gone", async () => {
    const storage = memoryStorage({
      [HANDLED_STORAGE_KEY]: { 9256204: Date.now() },
    });
    const store = createBuiltinStore(storage);
    const page = builtinTab({
      listHtml: loadFixture("list.html"),
      details: {
        [JOB_A]: loadFixture("detail-external.html"),
        [JOB_B]: loadFixture("detail-easyapply.html"),
      },
    });
    const activities = [];
    const records = await collectJobs(store, page.exec, {
      onActivity: (activity) => activities.push(activity),
    });
    expect(page.navigates).toContain(JOB_B);
    expect(page.navigates).not.toContain(JOB_A);
    expect(records.some((record) => record.badges?.includes("Easy Apply"))).toBe(true);

    const savedActivities = [];
    const savedPage = builtinTab({
      listHtml: loadFixture("list-saved.html"),
      hearts: { 22222222: true },
    });
    expect(
      await collectJobs(createBuiltinStore(memoryStorage()), savedPage.exec, {
        onActivity: (activity) => savedActivities.push(activity),
      }),
    ).toEqual([]);
    expect(savedPage.navigates.some((url) => /\/job\//.test(url))).toBe(false);
    expect(
      savedActivities.some(
        (activity) => activity.label === cardDecisionLabel("22222222", CARD_SKIP_HEART_SAVED),
      ),
    ).toBe(true);
    expect(
      activities.some(
        (activity) => activity.label === cardDecisionLabel("9256204", CARD_SKIP_HANDLED),
      ),
    ).toBe(true);

    const empty = builtinTab({ listHtml: loadFixture("list-empty.html") });
    expect(await collectJobs(createBuiltinStore(memoryStorage()), empty.exec)).toEqual([]);
  });

  test("resumes from a stored page and card cursor and honours Stop", async () => {
    const store = createBuiltinStore(memoryStorage());
    await store.saveCursor({
      listIndex: 0,
      page: 1,
      lastJobId: "9256204",
      lists: [LIST_URL],
    });
    const page = builtinTab();
    const records = await collectJobs(store, page.exec);
    expect(records.some((record) => record.title.includes("Staff/ Principal Engineer"))).toBe(true);
    expect(page.navigates).toContain(JOB_B);
    expect(page.navigates).not.toContain(JOB_A);

    const stopper = new AbortController();
    stopper.abort();
    await expect(
      runRoutinePass(routine, {
        exec: builtinTab().exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
        signal: stopper.signal,
      }),
    ).rejects.toBeInstanceOf(RoutineStoppedError);
  });

  test("retries a hung navigation and backs off a 403 without stopping the run", async () => {
    const store = createBuiltinStore(memoryStorage());
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-easyapply.html") },
      timeoutOnce: (url) => url === JOB_A,
      blockOnce: (url) => url === JOB_A,
    });
    const records = await collectJobs(store, page.exec);
    expect(records).toHaveLength(1);
    expect(page.navigates.filter((url) => url === JOB_A).length).toBeGreaterThan(1);
    expect(page.fetches).toEqual([]);
  });

  test("does not stop after 3+ 403 blocks on the same page", async () => {
    let blocks = 0;
    const page = builtinTab({
      listHtml: loadFixture("list-last.html"),
      details: { [JOB_A]: loadFixture("detail-easyapply.html") },
      blockWhen: (href) => {
        if (href !== JOB_A) return false;
        blocks += 1;
        return blocks <= 4;
      },
    });
    const records = await collectJobs(createBuiltinStore(memoryStorage()), page.exec);
    expect(blocks).toBeGreaterThanOrEqual(3);
    expect(records).toHaveLength(1);
    expect(page.navigates.filter((href) => href === JOB_A).length).toBeGreaterThanOrEqual(3);
  });

  test("pauses the run after repeated sign-in redirects", async () => {
    await expect(
      runRoutinePass(routine, {
        exec: builtinTab({ loginWall: true }).exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: STUCK_LOGIN_MESSAGE,
    });
  });

  test("pauses the run after N consecutive failures on the same page", async () => {
    await expect(
      runRoutinePass(routine, {
        exec: builtinTab({
          listHtml: loadFixture("list-last.html"),
          details: { [JOB_A]: loadFixture("detail-easyapply.html") },
          timeoutWhen: (href) => href === JOB_A,
        }).exec,
        store: createBuiltinStore(memoryStorage()),
        skipDelays: true,
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: stuckPageMessage(STUCK_PAGE_FAILURES),
    });
  });

  test("does not change JobRight's visible listDetail contract", () => {
    expect(JobRightRoutine.runPass).toBeUndefined();
    expect(JobRightRoutine.options.allowFetch).toBe(true);
    expect(JobRightRoutine.runView.settings).toEqual([]);
    expect(JobRightRoutine.runView.components).not.toContain("pace");
    expect(JobRightRoutine.strategy.kind).toBe("listDetail");
    expect(JobRightRoutine.strategy.open.some((step) => step.kind === "click")).toBe(true);
  });
});
