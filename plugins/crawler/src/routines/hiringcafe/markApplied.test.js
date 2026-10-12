import { describe, expect, test } from "bun:test";

import {
  appliedStateFromHtml,
  hasAppliedCheck,
  hasMarkAppliedControl,
  hasMarkToast,
  isSignedOutWall,
  markConfirmed,
  stageUpdateSucceeded,
} from "./appliedState.js";
import {
  APPLIED_CHECK_TEXT,
  MARK_APPLIED_TEXT,
  MARK_TOAST_TEXT,
  SIGN_IN_TO_MARK_MESSAGE,
  UPDATE_STAGE_OK,
  UPDATE_STAGE_PATH,
} from "./constants.js";
import { markAppliedOnCard, markAppliedOnDetail, readAppliedOnCard } from "./markApplied.js";
import {
  cardMarkup,
  carouselMarkup,
  listPageHtml,
  overlayMarkup,
  signInDialogMarkup,
  toastMarkup,
} from "./testing/pageHtml.js";
import "./testing/domParser.js";

const JOB = {
  id: "reqaaa1111111111",
  groupIds: ["reqaaa1111111111", "reqbbb2222222222", "reqccc3333333333"],
  groupIndex: 1,
  groupSize: 3,
};

function listWith(overlay, extras = {}) {
  return listPageHtml({
    ...extras,
    cards: [
      cardMarkup(`/job/help-desk-coordinator-reqaaa1111111111`, "3h", {
        overlay,
        carousel: carouselMarkup(3, 1),
      }),
      cardMarkup(`/job/labor-production-reqddd4444444444`, "5h"),
    ],
  });
}

function markHarness({
  htmlAfterHover,
  htmlAfterClick,
  fetchHits = [
    { url: `https://hiringcafe.com${UPDATE_STAGE_PATH}`, status: 200, body: UPDATE_STAGE_OK },
  ],
} = {}) {
  const ops = [];
  let html = listWith("");
  let marked = false;
  const call = async (op, payload = {}) => {
    ops.push({ op, ...payload });
    if (op === "hover") {
      if (!marked) html = htmlAfterHover ?? listWith(overlayMarkup());
      return { found: true };
    }
    if (op === "click" && payload.contains === MARK_APPLIED_TEXT) {
      marked = true;
      html = htmlAfterClick ?? listWith(overlayMarkup({ applied: true }), { toast: true });
      return { found: true };
    }
    if (op === "click") return { found: true };
    if (op === "watchFetch") return { watching: true };
    if (op === "watchedFetches") return { hits: fetchHits };
    if (op === "unwatchFetch") return { watching: false };
    if (op === "scroll") return { found: true };
    return {};
  };
  return {
    ops,
    call,
    readPage: async () => ({ html, url: "https://hiringcafe.com/classic", status: 200 }),
  };
}

describe("HiringCafe applied-state readers", () => {
  test("reads Applied ✓ and Mark Applied from the hover overlay", () => {
    const unmarked = listWith(overlayMarkup());
    const marked = listWith(overlayMarkup({ applied: true }));
    expect(hasMarkAppliedControl(unmarked)).toBe(true);
    expect(hasAppliedCheck(unmarked)).toBe(false);
    expect(appliedStateFromHtml(marked, JOB)).toMatchObject({ marked: true, canMark: false });
    expect(hasMarkToast(`${unmarked}${toastMarkup()}`)).toBe(true);
    expect(isSignedOutWall(signInDialogMarkup())).toBe(true);
    expect(
      stageUpdateSucceeded([
        { url: `https://hiringcafe.com${UPDATE_STAGE_PATH}`, status: 200, body: UPDATE_STAGE_OK },
      ]),
    ).toBe(true);
    expect(markConfirmed({ applied: true, toast: true, fetchOk: false })).toBe(true);
    expect(markConfirmed({ applied: true, toast: false, fetchOk: true })).toBe(true);
    expect(markConfirmed({ applied: false, toast: true, fetchOk: true })).toBe(false);
  });
});

describe("markAppliedOnCard", () => {
  test("hovers, clicks Mark Applied, and confirms toast plus Applied ✓", async () => {
    const harness = markHarness();
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result.marked).toBe(true);
    expect(result.already).toBeUndefined();
    expect(harness.ops.some((op) => op.op === "hover")).toBe(true);
    expect(harness.ops.some((op) => op.op === "click" && op.contains === MARK_APPLIED_TEXT)).toBe(
      true,
    );
    expect(harness.ops.some((op) => op.op === "watchFetch")).toBe(true);
    expect(result.log).toContain("marked applied");
  });

  test("does not click when the overlay already shows Applied ✓", async () => {
    const harness = markHarness({ htmlAfterHover: listWith(overlayMarkup({ applied: true })) });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result).toMatchObject({ marked: true, already: true });
    expect(harness.ops.some((op) => op.op === "click" && op.contains === MARK_APPLIED_TEXT)).toBe(
      false,
    );
    expect(hasAppliedCheck(listWith(overlayMarkup({ applied: true })))).toBe(true);
    expect(APPLIED_CHECK_TEXT).toBe("Applied ✓");
  });

  test("pauses when the sign-in wall is showing", async () => {
    const harness = markHarness({
      htmlAfterHover: `${listWith(overlayMarkup())}${signInDialogMarkup()}`,
    });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result).toEqual({
      marked: false,
      signedOut: true,
      log: SIGN_IN_TO_MARK_MESSAGE,
    });
  });
});

describe("markAppliedOnDetail", () => {
  test("falls back when the detail page has no Mark Applied control", async () => {
    const html = listPageHtml();
    const result = await markAppliedOnDetail({
      job: JOB,
      call: async () => ({ found: false }),
      skipDelays: true,
      readPage: async () => ({ html, url: "https://hiringcafe.com/job/x", status: 200 }),
    });
    expect(result).toMatchObject({ skipped: true, via: "detail", marked: false });
  });
});

describe("readAppliedOnCard", () => {
  test("carousels to Show job N before hovering a grouped card", async () => {
    const clicks = [];
    const html = listWith(overlayMarkup());
    await readAppliedOnCard({
      job: { ...JOB, id: "reqbbb2222222222", groupIndex: 2 },
      call: async (op, payload = {}) => {
        if (op === "click") clicks.push(payload.selector);
        return { found: true };
      },
      skipDelays: true,
      readPage: async () => ({ html, url: "https://hiringcafe.com/classic", status: 200 }),
    });
    expect(clicks.some((selector) => String(selector).includes("Show job 2"))).toBe(true);
    expect(MARK_TOAST_TEXT).toBe("Job marked successfully");
  });
});
