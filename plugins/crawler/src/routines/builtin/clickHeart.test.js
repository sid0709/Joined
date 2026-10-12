import { describe, expect, test } from "bun:test";

import { saveListCardHeart } from "./clickHeart.js";
import {
  HEART_CLICK_HEART,
  HEART_FAIL_NOT_SAVED,
  HEART_FAIL_UNREAD,
  HEART_SAVE_LABEL,
  SIGN_UP_MODAL_TEXT,
  heartAlreadySavedLog,
  heartFailedLog,
  heartRetryLog,
  heartSavedLog,
} from "./constants.js";
import { jobCardSelector, jobSaveSelector } from "./cssEscape.js";
import "./testing/domParser.js";

const JOB_ID = "9256204";

function heartState(saved, found = true) {
  if (!found) return { found: false, open: false, classes: "", prefix: "" };
  return {
    found: true,
    open: true,
    classes: saved ? "heart saved" : "heart",
    prefix: saved ? "fas" : "far",
  };
}

function heartHarness({
  savedAfter = [false, true],
  found = true,
  alreadySaved = false,
  signedOutAfter = 99,
  saveOnQueryAfterClick,
} = {}) {
  const ops = [];
  let queries = 0;
  let clicks = 0;
  let queriesAfterClick = 0;
  const call = async (op, payload = {}) => {
    ops.push({ op, ...payload });
    if (op === "shadow" && payload.action === "query") {
      queries += 1;
      if (alreadySaved) return heartState(true, found);
      if (clicks === 0) return heartState(false, found);
      queriesAfterClick += 1;
      if (
        saveOnQueryAfterClick != null &&
        clicks === 1 &&
        queriesAfterClick >= saveOnQueryAfterClick
      ) {
        return heartState(true, found);
      }
      return heartState(Boolean(savedAfter[clicks - 1]), found);
    }
    if (op === "shadow" && payload.action === "click") {
      clicks += 1;
      queriesAfterClick = 0;
    }
    return {};
  };
  const htmlAfter = (index) =>
    index >= signedOutAfter
      ? `<dialog>${SIGN_UP_MODAL_TEXT}</dialog>`
      : '<script>Builtin.jobBoardInit({"isLoggedIn":true});</script>';
  let reads = 0;
  return {
    ops,
    clicks: () => clicks,
    save: (extra = {}) =>
      saveListCardHeart({
        jobId: JOB_ID,
        call,
        rest: async () => {},
        checkStopped: () => {},
        skipDelays: true,
        onActivity: extra.onActivity,
        readPage: async () => {
          reads += 1;
          return { html: htmlAfter(reads) };
        },
      }),
  };
}

describe("saveListCardHeart", () => {
  test("scrolls the card, clicks once, and logs heart saved", async () => {
    const activities = [];
    const harness = heartHarness({ savedAfter: [true] });
    await expect(harness.save({ onActivity: (row) => activities.push(row) })).resolves.toEqual({
      saved: true,
      log: heartSavedLog(JOB_ID),
    });
    expect(harness.clicks()).toBe(1);
    expect(harness.ops.filter((op) => op.op === "scroll")).toEqual([
      { op: "scroll", selector: jobCardSelector(JOB_ID) },
    ]);
    expect(harness.ops.filter((op) => op.action === "click")).toEqual([
      {
        op: "shadow",
        host: jobSaveSelector(JOB_ID),
        inner: "div.heart",
        action: "click",
        which: HEART_CLICK_HEART,
      },
    ]);
    expect(activities.some((row) => row.label === HEART_SAVE_LABEL)).toBe(true);
    expect(activities.some((row) => row.label === heartSavedLog(JOB_ID))).toBe(true);
  });

  test("skips the retry click when a re-read finds the heart already saved", async () => {
    const activities = [];
    const harness = heartHarness({ savedAfter: [false], saveOnQueryAfterClick: 2 });
    await expect(harness.save({ onActivity: (row) => activities.push(row) })).resolves.toEqual({
      saved: true,
      log: heartSavedLog(JOB_ID),
    });
    expect(harness.clicks()).toBe(1);
    expect(activities.some((row) => row.label === heartRetryLog(JOB_ID))).toBe(false);
    expect(activities.some((row) => row.label === heartSavedLog(JOB_ID))).toBe(true);
  });

  test("retries once when the first click does not save", async () => {
    const activities = [];
    const harness = heartHarness({ savedAfter: [false, true] });
    await expect(harness.save({ onActivity: (row) => activities.push(row) })).resolves.toEqual({
      saved: true,
      log: heartSavedLog(JOB_ID),
    });
    expect(harness.clicks()).toBe(2);
    expect(activities.some((row) => row.label === heartRetryLog(JOB_ID))).toBe(true);
  });

  test("logs heart failed when the retry still does not save", async () => {
    const harness = heartHarness({ savedAfter: [false, false] });
    await expect(harness.save()).resolves.toEqual({
      saved: false,
      log: heartFailedLog(HEART_FAIL_NOT_SAVED, JOB_ID),
    });
    expect(harness.clicks()).toBe(2);
  });

  test("does not click when the shadow heart cannot be read", async () => {
    const harness = heartHarness({ found: false });
    await expect(harness.save()).resolves.toEqual({
      saved: false,
      log: heartFailedLog(HEART_FAIL_UNREAD, JOB_ID),
    });
    expect(harness.clicks()).toBe(0);
  });

  test("logs heart already saved without clicking when the card is already saved", async () => {
    const harness = heartHarness({ alreadySaved: true });
    await expect(harness.save()).resolves.toEqual({
      saved: true,
      log: heartAlreadySavedLog(JOB_ID),
      alreadySaved: true,
    });
    expect(harness.clicks()).toBe(0);
  });

  test("treats a missing host plus a visible Saved badge as already saved", async () => {
    const html = `<!DOCTYPE html><html><body>
      <div id="job-card-${JOB_ID}" data-id="job-card">
        <h2><a data-id="job-card-title" href="/job/role/${JOB_ID}">Role</a></h2>
        <span x-show="showSavedTag === true" class="text-soft-pink-02">Saved</span>
      </div>
    </body></html>`;
    const ops = [];
    await expect(
      saveListCardHeart({
        jobId: JOB_ID,
        call: async (op, payload = {}) => {
          ops.push({ op, ...payload });
          if (op === "shadow" && payload.action === "query") return { found: false };
          return {};
        },
        rest: async () => {},
        checkStopped: () => {},
        skipDelays: true,
        readPage: async () => ({ html, url: "https://builtin.com/jobs" }),
      }),
    ).resolves.toEqual({
      saved: true,
      log: heartAlreadySavedLog(JOB_ID),
      alreadySaved: true,
    });
    expect(ops.some((row) => row.action === "click")).toBe(false);
  });

  test("after a click, a dropped host with a Saved badge is already saved, not a failure", async () => {
    let clicks = 0;
    const html = `<!DOCTYPE html><html><body>
      <div id="job-card-${JOB_ID}" data-id="job-card">
        <h2><a data-id="job-card-title" href="/job/role/${JOB_ID}">Role</a></h2>
        <span x-show="showSavedTag === true" class="text-soft-pink-02">Saved</span>
      </div>
    </body></html>`;
    const call = async (op, payload = {}) => {
      if (op === "shadow" && payload.action === "query") {
        if (clicks === 0) return { found: true, classes: "heart", prefix: "far" };
        return { found: false };
      }
      if (op === "shadow" && payload.action === "click") clicks += 1;
      return {};
    };
    await expect(
      saveListCardHeart({
        jobId: JOB_ID,
        call,
        rest: async () => {},
        checkStopped: () => {},
        skipDelays: true,
        readPage: async () => ({ html, url: "https://builtin.com/jobs" }),
      }),
    ).resolves.toEqual({
      saved: true,
      log: heartAlreadySavedLog(JOB_ID),
      alreadySaved: true,
    });
    expect(clicks).toBe(1);
  });

  test("stops with signedOut when the first click opens the save wall", async () => {
    const harness = heartHarness({ savedAfter: [false], signedOutAfter: 1 });
    await expect(harness.save()).resolves.toMatchObject({
      saved: false,
      signedOut: true,
      log: heartRetryLog(JOB_ID),
    });
    expect(harness.clicks()).toBe(1);
  });
});
