import { describe, expect, test } from "bun:test";

import { LIST_CHANGE_POLL_MS, NEXT_PAGE, NEXT_PAGE_LABEL } from "./constants.js";
import { emptyCursor } from "./lists.js";
import {
  clickNextPage,
  firstCardId,
  rememberObservedListUrl,
  waitForFirstCardChange,
} from "./paginate.js";
import { installDomParser } from "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

installDomParser();

const FILTERED =
  "https://builtin.com/jobs?daysSinceUpdated=1&city=&state=&country=USA&allLocations=true";
const LIST_HTML = loadFixture("list.html");
const LAST_HTML = loadFixture("list-last.html");
const PAGE_TWO_HTML = loadFixture("list-saved.html");

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

  test("waits until the first job id changes", async () => {
    let now = 0;
    let reads = 0;
    const result = await waitForFirstCardChange({
      readPage: async () => {
        reads += 1;
        return {
          html: reads === 1 ? LIST_HTML : PAGE_TWO_HTML,
          url: reads === 1 ? FILTERED : `${FILTERED}&page=2`,
        };
      },
      rest: async () => {
        now += LIST_CHANGE_POLL_MS;
      },
      skipDelays: false,
      checkStopped: () => {},
      previousFirstId: "9256204",
      now: () => now,
      timeoutMs: 1_000,
    });
    expect(result.changed).toBe(true);
    expect(result.firstId).toBe("22222222");
    expect(result.page.url).toBe(`${FILTERED}&page=2`);
  });

  test("reports no change when the first job id stays put", async () => {
    const result = await waitForFirstCardChange({
      readPage: async () => ({ html: LIST_HTML, url: FILTERED }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousFirstId: "9256204",
    });
    expect(result.changed).toBe(false);
    expect(result.firstId).toBe("9256204");

    let now = 0;
    const timedOut = await waitForFirstCardChange({
      readPage: async () => ({ html: LIST_HTML, url: FILTERED }),
      rest: async () => {
        now += LIST_CHANGE_POLL_MS;
      },
      skipDelays: false,
      checkStopped: () => {},
      previousFirstId: "9256204",
      now: () => now,
      timeoutMs: LIST_CHANGE_POLL_MS,
    });
    expect(timedOut.changed).toBe(false);
  });

  test("clicks Next and stops when the control is missing", async () => {
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
      previousFirstId: "9256204",
      onActivity: (activity) => activities.push(activity),
    });
    expect(missing).toEqual({ advanced: false });
    expect(clicks).toEqual([{ op: "click", payload: { selector: NEXT_PAGE } }]);
    expect(activities).toEqual([{ phase: "open", label: NEXT_PAGE_LABEL, kind: "click" }]);

    const advanced = await clickNextPage({
      call: async () => ({ found: true }),
      readPage: async () => ({ html: LAST_HTML, url: `${FILTERED}&page=2` }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousFirstId: "11111111",
      onActivity: () => {},
    });
    expect(advanced.advanced).toBe(true);
    expect(advanced.firstId).toBe("9256204");

    const stuck = await clickNextPage({
      call: async () => ({ found: true }),
      readPage: async () => ({ html: LIST_HTML, url: FILTERED }),
      rest: async () => {},
      skipDelays: true,
      checkStopped: () => {},
      previousFirstId: "9256204",
      onActivity: () => {},
    });
    expect(stuck.advanced).toBe(false);
    expect(stuck.firstId).toBe("9256204");
  });
});
