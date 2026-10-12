import { describe, expect, test } from "bun:test";

import {
  appliedStateFromHtml,
  cardSelectorForJob,
  hasAppliedCheck,
  hasMarkAppliedControl,
  hasMarkToast,
  hasVisibleSignInModal,
  isHiringCafeSignedOut,
  isSignedOutWall,
  markConfirmed,
  stageUpdateSucceeded,
} from "./appliedState.js";
import {
  APPLIED_CHECK_TEXT,
  MARK_APPLIED_TEXT,
  MARK_TOAST_TEXT,
  NOT_MARKED_REASON,
  SIGN_IN_TO_MARK_MESSAGE,
  UPDATE_STAGE_OK,
  UPDATE_STAGE_PATH,
  jobCardSelector,
} from "./constants.js";
import {
  markAppliedForJob,
  markAppliedOnCard,
  markAppliedOnDetail,
  readAppliedOnCard,
  resolveMarkAfterDetail,
} from "./markApplied.js";
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
  path: "/job/help-desk-coordinator-reqaaa1111111111",
  url: "https://hiringcafe.com/job/help-desk-coordinator-reqaaa1111111111",
  cardHref: "https://hiringcafe.com/job/help-desk-coordinator-reqaaa1111111111",
  groupIds: ["reqaaa1111111111", "reqbbb2222222222", "reqccc3333333333"],
  groupPaths: [
    "/job/help-desk-coordinator-reqaaa1111111111",
    "/job/associate-category-manager-reqbbb2222222222",
    "/job/category-manager-reqccc3333333333",
  ],
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
  hoverClickThrows = false,
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
    if (op === "hoverClick" || (op === "click" && payload.contains === MARK_APPLIED_TEXT)) {
      if (op === "hoverClick" && !marked) html = htmlAfterHover ?? listWith(overlayMarkup());
      const canClick = html.includes(MARK_APPLIED_TEXT) && !html.includes("Applied ✓");
      if (!canClick) return { found: false, hovered: op === "hoverClick" };
      marked = true;
      html = htmlAfterClick ?? listWith(overlayMarkup({ applied: true }), { toast: true });
      if (op === "hoverClick" && hoverClickThrows) {
        throw new Error("hoverClick message failed after click");
      }
      return { found: true, hovered: true };
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
    expect(hasMarkToast(`${unmarked}<p>${MARK_TOAST_TEXT}</p>`)).toBe(false);
    expect(hasMarkToast("")).toBe(false);
    expect(isSignedOutWall(signInDialogMarkup())).toBe(true);
    expect(
      stageUpdateSucceeded([
        { url: `https://hiringcafe.com${UPDATE_STAGE_PATH}`, status: 200, body: UPDATE_STAGE_OK },
      ]),
    ).toBe(true);
    expect(markConfirmed({ applied: true, toast: true, fetchOk: false })).toBe(true);
    expect(markConfirmed({ applied: true, toast: false, fetchOk: true })).toBe(true);
    expect(markConfirmed({ applied: false, toast: true, fetchOk: false })).toBe(true);
    expect(markConfirmed({ applied: false, toast: false, fetchOk: true })).toBe(true);
    expect(markConfirmed({ applied: false, toast: false, fetchOk: false })).toBe(false);
    expect(jobCardSelector(JOB)).toContain('href$="/job/help-desk-coordinator-reqaaa1111111111"');
    expect(cardSelectorForJob(JOB)).toContain("help-desk-coordinator-reqaaa1111111111");
  });

  test("reads Applied ✓ only on the matched card, not a sibling", () => {
    const html = listPageHtml({
      cards: [
        cardMarkup(`/job/help-desk-coordinator-reqaaa1111111111`, "3h", {
          overlay: overlayMarkup(),
        }),
        cardMarkup(`/job/labor-production-reqddd4444444444`, "5h", {
          overlay: overlayMarkup({ applied: true }),
        }),
      ],
    });
    expect(appliedStateFromHtml(html, JOB).marked).toBe(false);
    expect(
      appliedStateFromHtml(html, {
        id: "reqddd4444444444",
        url: "https://hiringcafe.com/job/labor-production-reqddd4444444444",
        cardHref: "https://hiringcafe.com/job/labor-production-reqddd4444444444",
      }).marked,
    ).toBe(true);
    expect(hasAppliedCheck(html)).toBe(true);
  });

  test("uses ssrSignedIn or a visible sign-in modal only", () => {
    expect(isHiringCafeSignedOut(listPageHtml({ ssrSignedIn: true }))).toBe(false);
    expect(isHiringCafeSignedOut(listPageHtml({ ssrSignedIn: false }))).toBe(true);
    expect(hasVisibleSignInModal(signInDialogMarkup())).toBe(true);
    expect(
      hasVisibleSignInModal(
        `<div role="dialog" style="display:none">${SIGN_IN_TO_MARK_MESSAGE}</div>`,
      ),
    ).toBe(false);
    expect(isSignedOutWall(`<html>sign in so we can update your job tracker</html>`)).toBe(false);
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
    expect(
      harness.ops.some(
        (op) => (op.op === "hoverClick" || op.op === "click") && op.contains === MARK_APPLIED_TEXT,
      ),
    ).toBe(true);
    expect(harness.ops.some((op) => op.op === "watchFetch")).toBe(true);
    expect(result.log).toContain("marked applied");
  });

  test("does not click again when hoverClick throws after the overlay click", async () => {
    const harness = markHarness({ hoverClickThrows: true });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result.marked).toBe(true);
    expect(harness.ops.filter((op) => op.op === "hoverClick")).toHaveLength(1);
    expect(harness.ops.some((op) => op.op === "click" && op.contains === MARK_APPLIED_TEXT)).toBe(
      false,
    );
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

  test("does not click when confirm sees a signed-out wall", async () => {
    const harness = markHarness({
      htmlAfterClick: listPageHtml({
        ssrSignedIn: false,
        toast: true,
        cards: [
          cardMarkup(`/job/help-desk-coordinator-reqaaa1111111111`, "3h", {
            overlay: overlayMarkup({ applied: true }),
          }),
        ],
      }),
    });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result).toMatchObject({ marked: false, signedOut: true });
  });

  test("logs a per-job reason when hover never reveals Mark Applied", async () => {
    const harness = markHarness({ htmlAfterHover: listWith("") });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result.marked).toBe(false);
    expect(result.reason).toBe("hover missed overlay");
    expect(result.log).toBe("Job reqaaa1111111111 not marked applied: hover missed overlay");
  });

  test("returns not marked when toast and stage update are missing", async () => {
    const harness = markHarness({
      htmlAfterClick: listWith(overlayMarkup()),
      fetchHits: [],
    });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result.marked).toBe(false);
    expect(result.reason).toBe("no Applied ✓, toast, or stage 200");
    expect(result.log).toContain("not marked applied: no Applied ✓, toast, or stage 200");
  });

  test("pauses when the sign-in wall is showing", async () => {
    const harness = markHarness({
      htmlAfterHover: `${listPageHtml({
        ssrSignedIn: false,
        cards: [
          cardMarkup(`/job/help-desk-coordinator-reqaaa1111111111`, "3h", {
            overlay: overlayMarkup(),
            carousel: carouselMarkup(3, 1),
          }),
        ],
      })}${signInDialogMarkup()}`,
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
  test("clicks Mark Applied on the detail page when the control is present", async () => {
    let html = listWith(overlayMarkup());
    const result = await markAppliedOnDetail({
      job: JOB,
      skipDelays: true,
      call: async (op, payload = {}) => {
        if (op === "click" && payload.contains === MARK_APPLIED_TEXT) {
          html = listWith(overlayMarkup({ applied: true }), { toast: true });
        }
        if (op === "watchedFetches") {
          return {
            hits: [
              {
                url: `https://hiringcafe.com${UPDATE_STAGE_PATH}`,
                status: 200,
                body: UPDATE_STAGE_OK,
              },
            ],
          };
        }
        return { found: true };
      },
      readPage: async () => ({ html, url: "https://hiringcafe.com/job/x", status: 200 }),
    });
    expect(result).toMatchObject({ marked: true, via: "detail" });
  });

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

  test("treats Applied ✓ on the detail page as already marked", async () => {
    const html = listWith(overlayMarkup({ applied: true }));
    const result = await markAppliedOnDetail({
      job: JOB,
      call: async () => ({ found: true }),
      skipDelays: true,
      readPage: async () => ({ html, url: "https://hiringcafe.com/job/x", status: 200 }),
    });
    expect(result).toMatchObject({ marked: true, already: true, via: "detail" });
  });

  test("pauses when the detail page is signed out", async () => {
    const result = await markAppliedOnDetail({
      job: JOB,
      call: async () => ({ found: true }),
      skipDelays: true,
      readPage: async () => ({
        html: listPageHtml({ ssrSignedIn: false }),
        url: "https://hiringcafe.com/job/x",
        status: 200,
      }),
    });
    expect(result).toMatchObject({ marked: false, signedOut: true, via: "detail" });
  });

  test("pauses when confirm after a detail click is signed out", async () => {
    let html = listWith(overlayMarkup());
    const result = await markAppliedOnDetail({
      job: JOB,
      skipDelays: true,
      call: async (op) => {
        if (op === "click") html = listPageHtml({ ssrSignedIn: false });
        return { found: true, hits: [] };
      },
      readPage: async () => ({ html, url: "https://hiringcafe.com/job/x", status: 200 }),
    });
    expect(result).toMatchObject({ marked: false, signedOut: true, via: "detail" });
  });

  test("skips when Mark Applied is toggled off", async () => {
    const result = await markAppliedOnDetail({
      job: JOB,
      enabled: false,
      call: async () => ({ found: true }),
      skipDelays: true,
      readPage: async () => ({ html: listPageHtml(), url: "https://hiringcafe.com/job/x" }),
    });
    expect(result).toMatchObject({ skipped: true, marked: false, via: "detail" });
  });
});

describe("markAppliedForJob", () => {
  test("falls back to the list card when detail has no control", async () => {
    const harness = markHarness();
    const result = await markAppliedForJob({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
    });
    expect(result.marked).toBe(true);
  });

  test("returns the detail result when the control is on the page", async () => {
    let html = listWith(overlayMarkup());
    const result = await markAppliedForJob({
      job: JOB,
      skipDelays: true,
      call: async (op, payload = {}) => {
        if (op === "click" && payload.contains === MARK_APPLIED_TEXT) {
          html = listWith(overlayMarkup({ applied: true }), { toast: true });
        }
        if (op === "watchedFetches") {
          return {
            hits: [
              {
                url: `https://hiringcafe.com${UPDATE_STAGE_PATH}`,
                status: 200,
                body: UPDATE_STAGE_OK,
              },
            ],
          };
        }
        return { found: true };
      },
      readPage: async () => ({ html, url: "https://hiringcafe.com/job/x", status: 200 }),
    });
    expect(result).toMatchObject({ marked: true, via: "detail" });
  });

  test("returns signed-out from the detail probe", async () => {
    const result = await markAppliedForJob({
      job: JOB,
      skipDelays: true,
      call: async () => ({ found: true }),
      readPage: async () => ({
        html: listPageHtml({ ssrSignedIn: false }),
        url: "https://hiringcafe.com/job/x",
      }),
    });
    expect(result).toMatchObject({ signedOut: true, via: "detail" });
  });

  test("does nothing when the toggle is off", async () => {
    const result = await markAppliedForJob({
      job: JOB,
      enabled: false,
      call: async () => ({ found: true }),
      skipDelays: true,
      readPage: async () => ({ html: listPageHtml() }),
    });
    expect(result).toEqual({ marked: false, skipped: true, log: "" });
  });

  test("does not click Mark Applied a second time after detail NOT_CONFIRMED", async () => {
    let html = listWith(overlayMarkup());
    let markClicks = 0;
    const result = await markAppliedForJob({
      job: JOB,
      skipDelays: true,
      call: async (op, payload = {}) => {
        if (op === "click" && payload.contains === MARK_APPLIED_TEXT) {
          markClicks += 1;
          html = listWith(overlayMarkup());
        }
        if (op === "watchedFetches") return { hits: [] };
        return { found: true };
      },
      readPage: async () => ({ html, url: "https://hiringcafe.com/job/x", status: 200 }),
    });
    expect(markClicks).toBe(1);
    expect(result.marked).toBe(false);
    expect(result.reason).toBe(NOT_MARKED_REASON.NOT_CONFIRMED);
  });
});

describe("resolveMarkAfterDetail", () => {
  test("falls back to the card only when detail clicked nothing", async () => {
    const harness = markHarness();
    const result = await resolveMarkAfterDetail(
      {
        marked: false,
        skipped: true,
        via: "detail",
        reason: NOT_MARKED_REASON.NO_SELECTOR,
        log: "",
      },
      { job: JOB, call: harness.call, skipDelays: true, readPage: harness.readPage },
    );
    expect(result.marked).toBe(true);
    expect(
      harness.ops.some(
        (op) => (op.op === "hoverClick" || op.op === "click") && op.contains === MARK_APPLIED_TEXT,
      ),
    ).toBe(true);
  });

  test("re-reads Applied ✓ after NOT_CONFIRMED and never clicks again", async () => {
    const harness = markHarness({ htmlAfterHover: listWith(overlayMarkup({ applied: true })) });
    const result = await resolveMarkAfterDetail(
      {
        marked: false,
        via: "detail",
        reason: NOT_MARKED_REASON.NOT_CONFIRMED,
        log: "Job reqaaa1111111111 not marked applied: no Applied ✓, toast, or stage 200",
      },
      { job: JOB, call: harness.call, skipDelays: true, readPage: harness.readPage },
    );
    expect(result).toMatchObject({ marked: true, already: true, via: "reread" });
    expect(harness.ops.some((op) => op.op === "click" && op.contains === MARK_APPLIED_TEXT)).toBe(
      false,
    );
  });

  test("surfaces the not-marked reason on the errors notice", async () => {
    const notices = [];
    const harness = markHarness({ htmlAfterHover: listWith("") });
    const result = await markAppliedOnCard({
      job: JOB,
      call: harness.call,
      skipDelays: true,
      readPage: harness.readPage,
      onNotice: (message, ok) => notices.push({ message, ok }),
    });
    expect(result.reason).toBe(NOT_MARKED_REASON.HOVER_MISSED);
    expect(notices).toEqual([{ message: result.log, ok: false }]);
  });

  test("does not click again when the re-read is still unmarked", async () => {
    const harness = markHarness({ htmlAfterHover: listWith(overlayMarkup()) });
    const result = await resolveMarkAfterDetail(
      {
        marked: false,
        via: "detail",
        reason: NOT_MARKED_REASON.NOT_CONFIRMED,
        log: "Job reqaaa1111111111 not marked applied: no Applied ✓, toast, or stage 200",
      },
      { job: JOB, call: harness.call, skipDelays: true, readPage: harness.readPage },
    );
    expect(result.marked).toBe(false);
    expect(result.reason).toBe(NOT_MARKED_REASON.NOT_CONFIRMED);
    expect(harness.ops.some((op) => op.op === "click" && op.contains === MARK_APPLIED_TEXT)).toBe(
      false,
    );
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

  test("confirms from the toast when fetch watch ops fail", async () => {
    let html = listWith(overlayMarkup());
    const result = await markAppliedOnCard({
      job: JOB,
      skipDelays: true,
      call: async (op, payload = {}) => {
        if (op === "watchFetch" || op === "watchedFetches" || op === "unwatchFetch") {
          throw new Error("watch failed");
        }
        if ((op === "hoverClick" || op === "click") && payload.contains === MARK_APPLIED_TEXT) {
          html = listWith(overlayMarkup({ applied: true }), { toast: true });
        }
        return { found: true };
      },
      readPage: async () => ({ html, url: "https://hiringcafe.com/classic", status: 200 }),
    });
    expect(result.marked).toBe(true);
  });

  test("ignores failed hover helpers and still pauses when delays are on", async () => {
    const rests = [];
    const html = listWith(overlayMarkup({ applied: true }));
    const result = await readAppliedOnCard({
      job: { ...JOB, groupSize: 3, groupIndex: 2 },
      rest: (ms) => {
        rests.push(ms);
      },
      skipDelays: false,
      call: async (op) => {
        if (op === "click" || op === "scroll" || op === "watchFetch" || op === "unwatchFetch") {
          throw new Error("missing");
        }
        if (op === "watchedFetches") throw new Error("missing");
        return { found: true };
      },
      readPage: async () => ({ html, url: "https://hiringcafe.com/classic", status: 200 }),
    });
    expect(result.marked).toBe(true);
    expect(rests.length).toBeGreaterThan(0);
  });

  test("returns not marked when the card has no id", async () => {
    const result = await markAppliedOnCard({
      job: {},
      call: async () => ({ found: false }),
      skipDelays: true,
      readPage: async () => ({ html: listPageHtml() }),
    });
    expect(result.marked).toBe(false);
  });
});
