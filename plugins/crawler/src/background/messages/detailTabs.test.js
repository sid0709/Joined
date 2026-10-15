import { afterEach, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import {
  closeDetailTabs,
  isDetailTabUrl,
  MAX_DETAIL_TABS,
  openDetailTabs,
  readDetailPage,
  readDetailTabs,
  reloadDetailTabs,
  runDetailTabOp,
} from "./detailTabs.js";

const JOB = (n) => `https://hiringcafe.com/job/role-${n}`;
let nextOwner = 100;

/** A fresh crawl tab per test, so tracked job tabs never leak between tests. */
function owner() {
  nextOwner += 1;
  return { id: nextOwner, windowId: 3, index: 4, groupId: 11 };
}

function fakeIo(pageFor = () => ({ url: "", loading: false, html: "<html></html>" })) {
  let nextId = 500;
  const open = new Map();
  const calls = [];
  return {
    open,
    calls,
    createTab: async ({ url, active }) => {
      const id = nextId++;
      open.set(id, url);
      calls.push(["create", url, active]);
      return { id };
    },
    removeTab: async (id) => {
      open.delete(id);
      calls.push(["remove", id]);
    },
    reloadTab: async (id) => calls.push(["reload", id]),
    groupTabs: async (options) => calls.push(["group", options.groupId]),
    executeScript: async ({ target }) => [{ result: pageFor(open.get(target.tabId)) }],
  };
}

describe("detail tabs", () => {
  test("opens background tabs and keeps them open until closed", async () => {
    const crawl = owner();
    const io = fakeIo();
    const { tabs } = await openDetailTabs(crawl, { urls: [JOB(1), JOB(2)] }, io);
    expect(tabs.map((tab) => tab.url)).toEqual([JOB(1), JOB(2)]);
    expect(io.open.size).toBe(2);
    expect(io.calls.filter(([kind]) => kind === "create").every(([, , active]) => !active)).toBe(
      true,
    );
    await closeDetailTabs(crawl.id, { tabIds: [tabs[0].tabId] }, io);
    expect([...io.open.values()]).toEqual([JOB(2)]);
    await closeDetailTabs(crawl.id, {}, io);
    expect(io.open.size).toBe(0);
  });

  test("reads only parsed pages, and reports a tab between documents as loading", async () => {
    const crawl = owner();
    const io = fakeIo((url) =>
      url === JOB(1)
        ? { url, loading: false, html: `<html>${url}</html>` }
        : { url, loading: true, html: "" },
    );
    const { tabs } = await openDetailTabs(crawl, { urls: [JOB(1), JOB(2)] }, io);
    const { pages } = await readDetailTabs(crawl, { tabIds: tabs.map((tab) => tab.tabId) }, io);
    expect(pages[0]).toMatchObject({ html: `<html>${JOB(1)}</html>`, loading: false });
    expect(pages[1]).toMatchObject({ html: "", loading: true });
    io.executeScript = async () => {
      throw new Error("Frame with ID 0 is showing error page");
    };
    const committing = await readDetailTabs(crawl, { tabIds: [tabs[0].tabId] }, io);
    expect(committing.pages[0]).toMatchObject({ loading: true, html: "" });
    await closeDetailTabs(crawl.id, {}, io);
  });

  test("never reads, reloads, or closes a tab another crawl tab opened", async () => {
    const first = owner();
    const second = owner();
    const io = fakeIo();
    const { tabs } = await openDetailTabs(first, { urls: [JOB(1)] }, io);
    const foreign = [tabs[0].tabId, 9999];
    expect((await readDetailTabs(second, { tabIds: foreign }, io)).pages).toEqual([]);
    expect(await reloadDetailTabs(second, { tabIds: foreign }, io)).toEqual({ reloaded: 0 });
    expect(await closeDetailTabs(second.id, { tabIds: foreign }, io)).toEqual({ closed: 0 });
    expect(io.open.size).toBe(1);
    expect(await reloadDetailTabs(first, { tabIds: [tabs[0].tabId] }, io)).toEqual({
      reloaded: 1,
    });
    await closeDetailTabs(first.id, {}, io);
  });

  test("refuses off-board URLs and reports a tab that could not be created", async () => {
    const crawl = owner();
    const io = fakeIo();
    io.groupTabs = async () => {
      throw new Error("group gone");
    };
    const created = await openDetailTabs(crawl, { urls: ["https://evil.example/x", JOB(1)] }, io);
    expect(created.tabs[0].error).toBeTruthy();
    expect(created.tabs[1].tabId).toBeDefined();
    io.createTab = async () => {
      throw new Error("window closed");
    };
    const failed = await openDetailTabs(crawl, { urls: [JOB(2)] }, io);
    expect(failed.tabs[0]).toEqual({ url: JOB(2), error: "window closed" });
    io.removeTab = async () => {
      throw new Error("tab gone");
    };
    await closeDetailTabs(crawl.id, {}, io);
    expect(isDetailTabUrl("not a url")).toBe(false);
    expect(isDetailTabUrl("http://hiringcafe.com/job/x")).toBe(false);
  });

  test("opens at most MAX_DETAIL_TABS at once", async () => {
    const crawl = owner();
    const io = fakeIo();
    const urls = Array.from({ length: MAX_DETAIL_TABS + 5 }, (_, n) => JOB(n));
    const { tabs } = await openDetailTabs(crawl, { urls }, io);
    expect(tabs).toHaveLength(MAX_DETAIL_TABS);
    await closeDetailTabs(crawl.id, {}, io);
  });

  test("routes each op name", async () => {
    const crawl = owner();
    const io = fakeIo();
    const { tabs } = await runDetailTabOp("openDetailTabs", crawl, { urls: [JOB(1)] }, io);
    const tabIds = [tabs[0].tabId];
    expect((await runDetailTabOp("readDetailTabs", crawl, { tabIds }, io)).pages).toHaveLength(1);
    expect(await runDetailTabOp("reloadDetailTabs", crawl, { tabIds }, io)).toEqual({
      reloaded: 1,
    });
    expect(await runDetailTabOp("closeDetailTabs", crawl, { tabIds }, io)).toEqual({ closed: 1 });
  });
});

describe("chrome defaults and the in-tab reader", () => {
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

  test("uses chrome.tabs and chrome.scripting by default", async () => {
    const crawl = owner();
    const calls = [];
    globalThis.chrome = {
      tabs: {
        create: async (props) => {
          calls.push(["create", props.url]);
          return { id: 51 };
        },
        group: async (options) => calls.push(["group", options.groupId]),
        reload: async (id) => calls.push(["reload", id]),
        remove: async (id) => calls.push(["remove", id]),
      },
      scripting: {
        executeScript: async ({ target }) => {
          calls.push(["read", target.tabId]);
          return [{ result: { url: JOB(1), loading: false, html: "<html></html>" } }];
        },
      },
    };
    await openDetailTabs(crawl, { urls: [JOB(1)] });
    await readDetailTabs(crawl, { tabIds: [51] });
    await reloadDetailTabs(crawl, { tabIds: [51] });
    await closeDetailTabs(crawl.id);
    expect(calls).toEqual([
      ["create", JOB(1)],
      ["group", 11],
      ["read", 51],
      ["reload", 51],
      ["remove", 51],
    ]);
  });

  function inPage(html, readyState) {
    const { document } = parseHTML(html);
    Object.defineProperty(document, "readyState", { value: readyState });
    globalThis.document = document;
    globalThis.location = { href: JOB(1) };
  }

  test("readDetailPage returns the HTML only once the document has parsed", () => {
    inPage("<html><body><h1>Role</h1></body></html>", "interactive");
    const page = readDetailPage();
    expect(page).toMatchObject({ url: JOB(1), loading: false });
    expect(page.html).toContain("<h1>Role</h1>");
    inPage("<html><body></body></html>", "loading");
    expect(readDetailPage()).toEqual({ url: JOB(1), loading: true, html: "" });
  });
});
