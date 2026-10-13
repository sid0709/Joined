import { afterEach, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import {
  closeDetailTabs,
  DEFAULT_DETAIL_TAB_TIMEOUT_MS,
  DETAIL_TAB_ABORTED,
  isDetailTabUrl,
  openDetailTabs,
  readDetailPage,
} from "./detailTabs.js";

const OWNER = { id: 7, windowId: 3, index: 4, groupId: 11 };
const JOB = (n) => `https://hiringcafe.com/job/role-${n}`;

/** Fake chrome: `pageFor(url, reads)` decides what each poll of a tab sees. */
function fakeIo(pageFor) {
  let clock = 0;
  let nextId = 100;
  const open = new Map();
  const removed = [];
  const grouped = [];
  let maxOpen = 0;
  return {
    removed,
    grouped,
    open,
    get maxOpen() {
      return maxOpen;
    },
    createTab: async ({ url }) => {
      const id = nextId++;
      open.set(id, { url, reads: 0 });
      maxOpen = Math.max(maxOpen, open.size);
      return { id };
    },
    removeTab: async (id) => {
      open.delete(id);
      removed.push(id);
    },
    groupTabs: async (options) => grouped.push(options),
    executeScript: async ({ target }) => {
      const tab = open.get(target.tabId);
      tab.reads += 1;
      return [{ result: pageFor(tab.url, tab.reads) }];
    },
    sleep: async (ms) => {
      clock += ms;
      await Promise.resolve();
    },
    now: () => clock,
  };
}

const ready = (url) => ({ url, ready: true, challenge: false, html: `<html>${url}</html>` });

describe("openDetailTabs", () => {
  test("reads every job page and closes each tab once read", async () => {
    const io = fakeIo((url, reads) =>
      reads < 2 ? { ready: false, challenge: false, html: "" } : ready(url),
    );
    const urls = [JOB(1), JOB(2), JOB(3)];
    const { pages } = await openDetailTabs(OWNER, { urls }, io);
    expect(pages.map((page) => page.html)).toEqual(urls.map((url) => `<html>${url}</html>`));
    expect(io.open.size).toBe(0);
    expect(io.removed).toHaveLength(3);
    expect(io.grouped.every((call) => call.groupId === OWNER.groupId)).toBe(true);
  });

  test("closes the tab on a challenge, a timeout, and a script error", async () => {
    const io = fakeIo((url) => {
      if (url === JOB("challenge")) return { challenge: true, ready: false, html: "" };
      if (url === JOB("broken")) throw new Error("frame not ready");
      return { ready: false, challenge: false, html: "" };
    });
    const { pages } = await openDetailTabs(
      OWNER,
      { urls: [JOB("challenge"), JOB("broken"), JOB("slow")], timeoutMs: 1_000 },
      io,
    );
    expect(pages[0]).toEqual({ url: JOB("challenge"), challenge: true });
    expect(pages[1].error).toMatch(/timed out/);
    expect(pages[2].error).toMatch(/timed out/);
    expect(io.open.size).toBe(0);
    expect(io.removed).toHaveLength(3);
  });

  test("never has more tabs open than the concurrency", async () => {
    const io = fakeIo((url, reads) => (reads < 3 ? { ready: false } : ready(url)));
    const urls = Array.from({ length: 12 }, (_, n) => JOB(n));
    await openDetailTabs(OWNER, { urls, concurrency: 4 }, io);
    expect(io.maxOpen).toBe(4);
    expect(io.open.size).toBe(0);
  });

  test("refuses URLs off the supported boards without opening a tab", async () => {
    const io = fakeIo((url) => ready(url));
    const { pages } = await openDetailTabs(OWNER, { urls: ["https://evil.example/x"] }, io);
    expect(pages[0].error).toBeTruthy();
    expect(io.removed).toHaveLength(0);
    expect(isDetailTabUrl("http://hiringcafe.com/job/x")).toBe(false);
    expect(isDetailTabUrl(JOB(1))).toBe(true);
  });

  test("Stop closes the tabs still loading and ends the batch", async () => {
    const io = fakeIo(() => ({ ready: false }));
    const running = openDetailTabs(OWNER, { urls: [JOB(1), JOB(2)] }, io);
    await Promise.resolve();
    await Promise.resolve();
    await closeDetailTabs(OWNER.id, io);
    const { pages } = await running;
    expect(pages.every((page) => page.error === DETAIL_TAB_ABORTED)).toBe(true);
    expect(io.open.size).toBe(0);
  });

  test("defaults to the 20s per-tab timeout", () => {
    expect(DEFAULT_DETAIL_TAB_TIMEOUT_MS).toBe(20_000);
  });
});

describe("detail tab edge cases", () => {
  const saved = {
    chrome: globalThis.chrome,
    document: globalThis.document,
    location: globalThis.location,
  };
  afterEach(() => {
    globalThis.chrome = saved.chrome;
    globalThis.document = saved.document;
    globalThis.location = saved.location;
  });

  test("rejects a malformed URL", () => {
    expect(isDetailTabUrl("not a url")).toBe(false);
  });

  test("reports a tab that could not be created, without closing anything", async () => {
    const io = fakeIo((url) => ready(url));
    io.createTab = async () => {
      throw new Error("window closed");
    };
    const { pages } = await openDetailTabs(OWNER, { urls: [JOB(1)] }, io);
    expect(pages[0]).toEqual({ url: JOB(1), error: "window closed" });
    expect(io.removed).toHaveLength(0);
  });

  test("a failed group or close never fails the read", async () => {
    const io = fakeIo((url) => ready(url));
    io.groupTabs = async () => {
      throw new Error("group gone");
    };
    io.removeTab = async () => {
      throw new Error("tab gone");
    };
    const { pages } = await openDetailTabs(OWNER, { urls: [JOB(1)] }, io);
    expect(pages[0].html).toBe(`<html>${JOB(1)}</html>`);
    await closeDetailTabs(OWNER.id, io);
  });

  test("uses chrome.tabs and chrome.scripting by default", async () => {
    const calls = [];
    globalThis.chrome = {
      tabs: {
        create: async (props) => {
          calls.push(["create", props.url, props.active]);
          return { id: 51 };
        },
        group: async (options) => calls.push(["group", options.groupId]),
        remove: async (id) => calls.push(["remove", id]),
      },
      scripting: {
        executeScript: async ({ target }) => {
          calls.push(["read", target.tabId]);
          return [{ result: ready(JOB(1)) }];
        },
      },
    };
    const { pages } = await openDetailTabs(OWNER, { urls: [JOB(1)] });
    expect(pages[0].html).toBe(`<html>${JOB(1)}</html>`);
    expect(calls).toEqual([
      ["create", JOB(1), false],
      ["group", OWNER.groupId],
      ["read", 51],
      ["remove", 51],
    ]);
  });

  function inPage(html, { readyState = "complete", widgetSize = 0 } = {}) {
    const { document } = parseHTML(html);
    Object.defineProperty(document, "readyState", { value: readyState });
    for (const node of document.querySelectorAll(".cf-turnstile")) {
      node.getBoundingClientRect = () => ({ width: widgetSize, height: widgetSize });
    }
    globalThis.document = document;
    globalThis.location = { href: JOB(1) };
  }

  test("readDetailPage returns the HTML once every ready selector is present", () => {
    inPage(
      "<html><head><title>Role</title></head><body><h1>Role</h1><script id='__NEXT_DATA__'>{}</script></body></html>",
    );
    const page = readDetailPage(["h1", "#__NEXT_DATA__"], "just a moment", ".cf-turnstile");
    expect(page).toMatchObject({ url: JOB(1), ready: true, challenge: false });
    expect(page.html).toContain("<h1>Role</h1>");
    expect(readDetailPage(["h1", "#missing"], "", "")).toMatchObject({ ready: false, html: "" });
  });

  test("readDetailPage waits while the document is still loading", () => {
    inPage("<html><body><h1>Role</h1></body></html>", { readyState: "loading" });
    expect(readDetailPage(["h1"], "", "")).toMatchObject({ ready: false, html: "" });
  });

  test("readDetailPage flags a challenge by title or by a visible widget", () => {
    inPage("<html><head><title>Just a moment...</title></head><body><h1>x</h1></body></html>");
    expect(readDetailPage(["h1"], "just a moment", "")).toMatchObject({
      challenge: true,
      ready: false,
    });
    inPage("<html><body><h1>x</h1><div class='cf-turnstile'></div></body></html>", {
      widgetSize: 60,
    });
    expect(readDetailPage(["h1"], "", ".cf-turnstile")).toMatchObject({ challenge: true });
    inPage("<html><body><h1>x</h1><div class='cf-turnstile'></div></body></html>");
    expect(readDetailPage(["h1"], "", ".cf-turnstile")).toMatchObject({
      challenge: false,
      ready: true,
    });
  });
});
