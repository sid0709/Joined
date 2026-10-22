import { describe, expect, test } from "bun:test";

import {
  DETAIL_TAB_POLL_MS,
  DETAIL_TAB_RELOAD_AFTER_MS,
  DETAIL_TAB_TIMEOUT_MS,
  fetchDetailPages,
} from "./detailTabs.js";

const READY = "<html><h1>ready</h1></html>";
const BLANK = "<html><body></body></html>";
const isReady = (html) => html.includes("ready");

/** Fake background: `htmlFor(url, reads)` is what a tab shows on its Nth read. */
function background(htmlFor) {
  const tabs = new Map();
  const reads = new Map();
  const log = { opened: [], closed: [], reloaded: [] };
  let nextId = 1;
  const call = async (op, payload) => {
    if (op === "openDetailTabs") {
      return {
        tabs: payload.urls.map((url) => {
          if (url.includes("fail")) return { url, error: "window closed" };
          const tabId = nextId++;
          tabs.set(tabId, url);
          log.opened.push(tabId);
          return { url, tabId };
        }),
      };
    }
    if (op === "readDetailTabs") {
      return {
        pages: payload.tabIds.map((tabId) => {
          const url = tabs.get(tabId);
          const n = (reads.get(tabId) ?? 0) + 1;
          reads.set(tabId, n);
          return { tabId, url, loading: false, html: htmlFor(url, n) };
        }),
      };
    }
    if (op === "reloadDetailTabs") {
      log.reloaded.push(...payload.tabIds);
      return {};
    }
    for (const tabId of payload.tabIds) {
      tabs.delete(tabId);
      log.closed.push(tabId);
    }
    return {};
  };
  return { call, tabs, log };
}

const job = (id) => ({ id, url: `https://builtin.com/job/${id}` });

describe("fetchDetailPages", () => {
  test("keeps a blank tab open until the board's check passes, then closes it", async () => {
    const fake = background((url, n) => (url.endsWith("/slow") && n < 5 ? BLANK : READY));
    let waited = 0;
    const pages = await fetchDetailPages({
      call: fake.call,
      rest: async (ms) => {
        waited += ms;
      },
      jobs: [job("fast"), job("slow")],
      isReady,
    });
    expect([...pages.keys()]).toEqual(["fast", "slow"]);
    expect(waited).toBe(5 * DETAIL_TAB_POLL_MS);
    expect(fake.tabs.size).toBe(0);
  });

  test("reloads a stuck tab once, then gives up on it only at the timeout", async () => {
    const fake = background(() => BLANK);
    const pages = await fetchDetailPages({
      call: fake.call,
      rest: async () => {},
      jobs: [job("stuck")],
      isReady,
    });
    expect(pages.size).toBe(0);
    expect(fake.log.reloaded).toEqual([1]);
    expect(fake.tabs.size).toBe(0);
    expect(DETAIL_TAB_TIMEOUT_MS).toBeGreaterThan(DETAIL_TAB_RELOAD_AFTER_MS);
  });

  test("closes a challenged tab right away so the crawl tab can take it", async () => {
    const fake = background(() => "<html><title>Just a moment...</title></html>");
    let reads = 0;
    const pages = await fetchDetailPages({
      call: async (op, payload) => {
        if (op === "readDetailTabs") reads += 1;
        return fake.call(op, payload);
      },
      skipDelays: true,
      jobs: [job("cf")],
      isReady,
      isChallenge: (page) => page.html.includes("Just a moment"),
    });
    expect(pages.size).toBe(0);
    expect(reads).toBe(1);
    expect(fake.log.closed).toEqual([1]);
  });

  test("Stop closes every open job tab", async () => {
    const fake = background(() => BLANK);
    let checks = 0;
    await expect(
      fetchDetailPages({
        call: fake.call,
        skipDelays: true,
        checkStopped: () => {
          checks += 1;
          if (checks === 3) throw new Error("Routine stopped");
        },
        jobs: [job("a"), job("b")],
        isReady,
      }),
    ).rejects.toThrow("Routine stopped");
    expect(fake.tabs.size).toBe(0);
  });

  test("skips jobs without a URL or a tab, and survives a failed open op", async () => {
    const fake = background(() => READY);
    const pages = await fetchDetailPages({
      call: fake.call,
      skipDelays: true,
      jobs: [{ id: "nourl" }, job("fail"), job("ok")],
      isReady,
    });
    expect([...pages.keys()]).toEqual(["ok"]);
    expect(
      await fetchDetailPages({
        call: async () => {
          throw new Error("background gone");
        },
        skipDelays: true,
        jobs: [job("x")],
        isReady,
      }),
    ).toEqual(new Map());
    expect((await fetchDetailPages({ call: fake.call, jobs: [], isReady })).size).toBe(0);
  });

  test("a failing read, reload, or close never breaks the batch", async () => {
    const fake = background(() => BLANK);
    const pages = await fetchDetailPages({
      call: async (op, payload) => {
        if (op === "openDetailTabs") return fake.call(op, payload);
        throw new Error(`${op} failed`);
      },
      skipDelays: true,
      jobs: [job("a")],
      isReady,
    });
    expect(pages.size).toBe(0);
  });
});
