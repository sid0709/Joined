import { describe, expect, test } from "bun:test";

import { NAVIGATE_WAIT_MS, NEXT_PAGE } from "./constants.js";
import { clickNextPage } from "./nextPage.js";

const LIST = "https://hiringcafe.com/classic?searchState=%7B%22a%22%3A1%7D";
const PAGE_ONE = `${LIST}&page=1`;
const UNFILTERED_PAGE_ONE = "https://hiringcafe.com/classic?page=1";

function clock() {
  let now = 0;
  return {
    now: () => now,
    rest: async (ms) => {
      now += ms;
    },
  };
}

function reads(...pages) {
  let index = 0;
  return async () => {
    const page = pages[Math.min(index, pages.length - 1)];
    index += 1;
    if (page instanceof Error) throw page;
    return page;
  };
}

describe("clickNextPage", () => {
  test("clicks Next and returns the filtered page it lands on", async () => {
    const calls = [];
    const time = clock();
    const landed = { html: "<html></html>", url: PAGE_ONE };
    const page = await clickNextPage({
      call: async (op, payload) => {
        calls.push([op, payload.selector]);
        return { found: true };
      },
      readPage: reads(new Error("unloading"), { html: "", url: LIST }, landed),
      rest: time.rest,
      now: time.now,
      skipDelays: false,
      listUrl: LIST,
      pageIndex: 1,
    });
    expect(calls).toEqual([["click", NEXT_PAGE]]);
    expect(page).toBe(landed);
  });

  test("counts a lost click response as a click, since the link unloads the page", async () => {
    const time = clock();
    const landed = { html: "<html></html>", url: PAGE_ONE };
    const page = await clickNextPage({
      call: async () => {
        throw new Error("message channel closed");
      },
      readPage: reads(landed),
      rest: time.rest,
      now: time.now,
      listUrl: LIST,
      pageIndex: 1,
    });
    expect(page).toBe(landed);
  });

  test("returns null when there is no Next control", async () => {
    const page = await clickNextPage({
      call: async () => ({ found: false }),
      readPage: reads({ html: "<html></html>", url: PAGE_ONE }),
      rest: async () => {},
      listUrl: LIST,
      pageIndex: 1,
    });
    expect(page).toBeNull();
  });

  test("a landing that dropped the filters times out to null so the caller opens the URL", async () => {
    const time = clock();
    const page = await clickNextPage({
      call: async () => ({ found: true }),
      readPage: reads({ html: "<html></html>", url: UNFILTERED_PAGE_ONE }),
      rest: time.rest,
      now: time.now,
      checkStopped: () => {},
      listUrl: LIST,
      pageIndex: 1,
    });
    expect(page).toBeNull();
    expect(time.now()).toBeGreaterThanOrEqual(NAVIGATE_WAIT_MS);
  });

  test("with skipDelays reads once and checks the filters", async () => {
    const landed = { html: "<html></html>", url: PAGE_ONE };
    const args = {
      call: async () => ({ found: true }),
      rest: async () => {},
      skipDelays: true,
      listUrl: LIST,
      pageIndex: 1,
    };
    expect(await clickNextPage({ ...args, readPage: reads(landed) })).toBe(landed);
    expect(
      await clickNextPage({
        ...args,
        readPage: reads({ html: "<html></html>", url: UNFILTERED_PAGE_ONE }),
      }),
    ).toBeNull();
  });
});
