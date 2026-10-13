import { describe, expect, test } from "bun:test";

import { LIST_CHANGE_POLL_MS, NEXT_PAGE, NEXT_PAGE_LABEL } from "./constants.js";
import { cardIdKey, emptyCursor } from "./lists.js";
import {
  clickForwardCount,
  clickNextPage,
  firstCardId,
  listResultsChanged,
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
});
