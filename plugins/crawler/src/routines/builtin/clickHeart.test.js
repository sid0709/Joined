import { describe, expect, test } from "bun:test";

import { saveListCardHeart } from "./clickHeart.js";
import {
  HEART_CLICK_HEART,
  HEART_FAIL_NOT_SAVED,
  HEART_FAIL_UNREAD,
  HEART_SAVE_LABEL,
  SIGN_UP_MODAL_TEXT,
  heartFailedLog,
  heartRetryLog,
  heartSavedLog,
} from "./constants.js";
import { jobCardSelector, jobSaveSelector } from "./cssEscape.js";

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
} = {}) {
  const ops = [];
  let queries = 0;
  let clicks = 0;
  const call = async (op, payload = {}) => {
    ops.push({ op, ...payload });
    if (op === "shadow" && payload.action === "query") {
      queries += 1;
      if (alreadySaved) return heartState(true, found);
      if (clicks === 0) return heartState(false, found);
      return heartState(Boolean(savedAfter[clicks - 1]), found);
    }
    if (op === "shadow" && payload.action === "click") clicks += 1;
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

  test("logs heart saved without clicking when the card is already saved", async () => {
    const harness = heartHarness({ alreadySaved: true });
    await expect(harness.save()).resolves.toEqual({
      saved: true,
      log: heartSavedLog(JOB_ID),
    });
    expect(harness.clicks()).toBe(0);
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
