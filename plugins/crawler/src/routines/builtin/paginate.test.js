import { describe, expect, test } from "bun:test";

import {
  BUILTIN_WAIT_OP,
  LIST_CHANGE_POLL_MS,
  NEXT_PAGE,
  NEXT_PAGE_LABEL,
  PAGE_DELAY_MS,
  PAGE_STUCK_AFTER_NEXT_MESSAGE,
  WAIT_UNTIL,
} from "./constants.js";
import { cardIdKey, emptyCursor } from "./lists.js";
import {
  clickForwardCount,
  clickNextPage,
  firstCardId,
  listResultsChanged,
  openListForCursor,
  rememberObservedListUrl,
  restoreListUrl,
  waitForListChange,
} from "./paginate.js";
import { installDomParser } from "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

installDomParser();

const FILTERED =
  "https://builtin.com/jobs?daysSinceUpdated=1&city=&state=&country=USA&allLocations=true";
const LIST_HTML = loadFixture("list.html");
const LAST_HTML = loadFixture("list-last.html");
const PAGE_TWO_HTML = loadFixture("list-saved.html");
const PINNED_FIRST_HTML = LIST_HTML.replaceAll("11111111", "33333333");
const LIST_PAGE_IDS = cardIdKey([{ id: "9256204" }, { id: "11111111" }]);

describe("builtin click pagination", () => {
  test("remembers the observed list URL without rewriting params", () => {
    const cursor = emptyCursor([FILTERED], FILTERED);
    expect(rememberObservedListUrl(cursor, `${FILTERED}&page=2`).lists).toEqual([
      `${FILTERED}&page=2`,
    ]);
    expect(rememberObservedListUrl(cursor, FILTERED)).toBe(cursor);
    expect(rememberObservedListUrl(cursor, "https://builtin.com/job/role/1")).toBe(cursor);
    expect(firstCardId([{ id: "9256204" }, { id: "2" }])).toBe("9256204");
    expect(firstCardId([])).toBe("");
  });

  test("restores a landed page URL and otherwise clicks forward", () => {
    const start = emptyCursor([FILTERED], FILTERED);
    expect(restoreListUrl(start)).toBe(FILTERED);
    expect(clickForwardCount(start)).toBe(0);
    const landed = { ...start, page: 2, lists: [`${FILTERED}&page=2`] };
    expect(restoreListUrl(landed)).toBe(`${FILTERED}&page=2`);
    expect(restoreListUrl({ ...start, page: 3 })).toBe("");
    expect(clickForwardCount({ ...start, page: 3 })).toBe(2);
    expect(
      listResultsChanged({ pageIds: "a", url: FILTERED }, { pageIds: "a\nb", url: FILTERED }),
    ).toBe(true);
    expect(
      listResultsChanged(
        { pageIds: LIST_PAGE_IDS, url: FILTERED },
        { pageIds: LIST_PAGE_IDS, url: `${FILTERED}&page=2` },
      ),
    ).toBe(true);
  });

  test("waits through a slow load until the card set changes", async () => {
    let now = 0;
    let reads = 0;
    const result = await waitForListChange({
      readPage: async () => {
        reads += 1;
        return {
          html: reads < 3 ? LIST_HTML : PAGE_TWO_HTML,
          url: reads < 3 ? FILTERED : `${FILTERED}&page=2`,
        };
      },
      rest: async () => {
        now += LIST_CHANGE_POLL_MS;
      },
      skipDelays: false,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      now: () => now,
      timeoutMs: 1_000,
    });
    expect(result.changed).toBe(true);
    expect(result.pageIds).toBe("22222222");
    expect(result.page.url).toBe(`${FILTERED}&page=2`);
  });

  test("lets the page watch for the new card set instead of polling", async () => {
    const waits = [];
    let reads = 0;
    const result = await waitForListChange({
      call: async (op, payload) => {
        waits.push({ op, ...payload });
        return { until: payload.until, matched: true };
      },
      readPage: async () => {
        reads += 1;
        return { html: PAGE_TWO_HTML, url: `${FILTERED}&page=2` };
      },
      rest: async () => {
        throw new Error("no poll expected");
      },
      skipDelays: false,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      timeoutMs: 1_000,
    });
    expect(waits).toEqual([
      {
        op: BUILTIN_WAIT_OP,
        until: WAIT_UNTIL.LIST_CHANGE,
        previousPageIds: LIST_PAGE_IDS,
        timeoutMs: 1_000,
      },
    ]);
    expect(reads).toBe(1);
    expect(result.changed).toBe(true);
    expect(result.pageIds).toBe("22222222");
  });

  test("treats a pinned first card as a change when the rest of the set moves", async () => {
    const result = await waitForListChange({
      readPage: async () => ({ html: PINNED_FIRST_HTML, url: `${FILTERED}&page=2` }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
    });
    expect(result.changed).toBe(true);
    expect(result.firstId).toBe("9256204");
    expect(result.pageIds).toContain("33333333");
  });

  test("reports no change when the card set and URL stay put", async () => {
    const result = await waitForListChange({
      readPage: async () => ({ html: LIST_HTML, url: FILTERED }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
    });
    expect(result.changed).toBe(false);

    let now = 0;
    const timedOut = await waitForListChange({
      readPage: async () => ({ html: LIST_HTML, url: FILTERED }),
      rest: async () => {
        now += LIST_CHANGE_POLL_MS;
      },
      skipDelays: false,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      now: () => now,
      timeoutMs: LIST_CHANGE_POLL_MS,
    });
    expect(timedOut.changed).toBe(false);
  });

  test("clicks Next, retries a stuck page, and stops when the control is missing", async () => {
    const activities = [];
    const clicks = [];
    const missing = await clickNextPage({
      call: async (op, payload) => {
        clicks.push({ op, payload });
        return { found: false };
      },
      readPage: async () => ({ html: LAST_HTML, url: FILTERED }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      onActivity: (activity) => activities.push(activity),
    });
    expect(missing).toEqual({ advanced: false, found: false });
    expect(clicks).toEqual([{ op: "click", payload: { selector: NEXT_PAGE } }]);
    expect(activities).toEqual([{ phase: "open", label: NEXT_PAGE_LABEL, kind: "click" }]);

    const advanced = await clickNextPage({
      call: async () => ({ found: true }),
      readPage: async () => ({ html: LAST_HTML, url: `${FILTERED}&page=2` }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      onActivity: () => {},
    });
    expect(advanced.advanced).toBe(true);
    expect(advanced.firstId).toBe("9256204");

    const stuckClicks = [];
    const stuck = await clickNextPage({
      call: async () => {
        stuckClicks.push(NEXT_PAGE);
        return { found: true };
      },
      readPage: async () => ({ html: LIST_HTML, url: FILTERED }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      onActivity: () => {},
    });
    expect(stuck.advanced).toBe(false);
    expect(stuck.stuck).toBe(true);
    expect(stuckClicks).toHaveLength(2);
  });

  test("does not skip page N+1 by re-clicking Next after a late load", async () => {
    const clicks = [];
    let reads = 0;
    const result = await clickNextPage({
      call: async () => {
        clicks.push(NEXT_PAGE);
        return { found: true };
      },
      readPage: async () => {
        reads += 1;
        // Timed-out wait still sees page N. The pre-retry re-read sees N+1.
        if (reads === 1) return { html: LIST_HTML, url: FILTERED };
        return { html: PAGE_TWO_HTML, url: `${FILTERED}&page=2` };
      },
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      onActivity: () => {},
    });
    expect(clicks).toHaveLength(1);
    expect(result.advanced).toBe(true);
    expect(result.stuck).toBeUndefined();
    expect(result.page.url).toBe(`${FILTERED}&page=2`);
    expect(result.pageIds).toBe("22222222");
  });

  test("retries Next only when the re-read is still page N, then accepts a later advance", async () => {
    const clicks = [];
    let reads = 0;
    const result = await clickNextPage({
      call: async () => {
        clicks.push(NEXT_PAGE);
        return { found: true };
      },
      readPage: async () => {
        reads += 1;
        if (reads <= 2) return { html: LIST_HTML, url: FILTERED };
        return { html: PAGE_TWO_HTML, url: `${FILTERED}&page=2` };
      },
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousPageIds: LIST_PAGE_IDS,
      previousUrl: FILTERED,
      onActivity: () => {},
    });
    expect(clicks).toHaveLength(2);
    expect(result.advanced).toBe(true);
    expect(result.page.url).toBe(`${FILTERED}&page=2`);
  });

  test("pauses before each click-forward hop and blocks when Next does not advance", async () => {
    const pauses = [];
    const hops = [];
    const startPage = { html: LIST_HTML, url: FILTERED };
    const pageTwo = { html: PAGE_TWO_HTML, url: `${FILTERED}&page=2` };
    const cursor = { ...emptyCursor([FILTERED], FILTERED), page: 3 };
    expect(restoreListUrl(cursor)).toBe("");

    const landed = await openListForCursor({
      cursor,
      openVisible: async () => startPage,
      clickNext: async () => {
        hops.push("next");
        return { advanced: true, page: pageTwo };
      },
      label: "Opening page 3",
      pause: async (range) => {
        pauses.push(range);
      },
    });
    expect(landed).toEqual(pageTwo);
    expect(hops).toHaveLength(2);
    expect(pauses).toEqual([PAGE_DELAY_MS, PAGE_DELAY_MS]);

    const blockedPauses = [];
    await expect(
      openListForCursor({
        cursor,
        openVisible: async () => startPage,
        clickNext: async () => ({ advanced: false, found: true, stuck: true }),
        label: "Opening page 3",
        pause: async (range) => {
          blockedPauses.push(range);
        },
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: PAGE_STUCK_AFTER_NEXT_MESSAGE,
    });
    expect(blockedPauses).toEqual([PAGE_DELAY_MS]);

    const already = { html: LIST_HTML, url: FILTERED };
    expect(
      await openListForCursor({
        cursor,
        openVisible: async () => {
          throw new Error("should not open");
        },
        clickNext: async () => {
          throw new Error("should not hop");
        },
        alreadyOpen: already,
        label: "Opening page 3",
      }),
    ).toBe(already);

    const landedPage = { ...emptyCursor([`${FILTERED}&page=2`], FILTERED), page: 2 };
    const opened = [];
    expect(
      await openListForCursor({
        cursor: landedPage,
        openVisible: async (url) => {
          opened.push(url);
          return { html: PAGE_TWO_HTML, url };
        },
        clickNext: async () => {
          throw new Error("should not hop");
        },
        label: "Opening page 2",
      }),
    ).toMatchObject({ url: `${FILTERED}&page=2` });
    expect(opened).toEqual([`${FILTERED}&page=2`]);

    const noPauseHops = [];
    await openListForCursor({
      cursor,
      openVisible: async () => startPage,
      clickNext: async () => {
        noPauseHops.push("next");
        return { advanced: true, page: pageTwo };
      },
      label: "Opening page 3",
    });
    expect(noPauseHops).toHaveLength(2);

    await expect(
      openListForCursor({
        cursor,
        openVisible: async () => startPage,
        clickNext: async () => undefined,
        label: "Opening page 3",
        pause: async () => {},
      }),
    ).rejects.toMatchObject({
      name: "RoutineBlockedError",
      message: PAGE_STUCK_AFTER_NEXT_MESSAGE,
    });
  });
});
