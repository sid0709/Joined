import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { BOUND_TAB_MISSING_MESSAGE } from "../../routineKit/protocol.js";
import { getBoundTab, listBoundTabs, resetBoundTabs } from "../boundTab.js";

import {
  bindCrawlTab,
  handleBindTab,
  handleBoundTabRemoved,
  handleUnbindTab,
  unbindCrawlTab,
} from "./bindTab.js";

const TAB = { id: 21, windowId: 5, url: "https://www.builtin.com/jobs" };

beforeEach(() => {
  resetBoundTabs();
});

afterEach(() => {
  resetBoundTabs();
});

function io() {
  const released = [];
  const aborted = [];
  const keepalives = [];
  return {
    released,
    aborted,
    keepalives,
    tabs: { get: async () => TAB },
    groupBoundTab: async () => 9,
    startKeepalive: () => keepalives.push("start"),
    stopKeepalive: (count) => keepalives.push(["stop", count]),
    releaseDebugger: (tabId) => released.push(tabId),
    abortInFlightNavigate: (tabId) => aborted.push(tabId),
  };
}

function reply(handler, message, extraIo) {
  return new Promise((resolve) => {
    handler(message, resolve, extraIo ?? io());
  });
}

describe("bindCrawlTab", () => {
  test("binds the exact tabId and windowId and groups it", async () => {
    const next = io();
    const bind = await bindCrawlTab({ tabId: 21, windowId: 5, routineId: "builtin" }, next);
    expect(bind).toEqual({ tabId: 21, windowId: 5, groupId: 9, routineId: "builtin" });
    expect(getBoundTab(21)).toEqual(bind);
    expect(next.keepalives).toEqual(["start"]);
  });

  test("rejects a missing tabId", async () => {
    await expect(bindCrawlTab({}, io())).rejects.toThrow(BOUND_TAB_MISSING_MESSAGE);
  });

  test("unbinds and stops keepalive when no binds remain", async () => {
    const next = io();
    await saveThenUnbind(next);
    expect(unbindCrawlTab(21, next)).toEqual({ removed: true, tabId: 21 });
    expect(listBoundTabs()).toEqual([]);
    expect(next.keepalives).toContainEqual(["stop", 0]);
  });

  test("handleBoundTabRemoved releases the debugger and aborts navigate", async () => {
    const next = io();
    await bindCrawlTab({ tabId: 21, windowId: 5, routineId: "jobright" }, next);
    const bind = handleBoundTabRemoved(21, next);
    expect(bind.routineId).toBe("jobright");
    expect(next.released).toEqual([21]);
    expect(next.aborted).toEqual([21]);
    expect(getBoundTab(21)).toBeNull();
    expect(handleBoundTabRemoved(99, next)).toBeNull();
  });

  test("uses chrome.tabs.get when io is omitted", async () => {
    globalThis.chrome = {
      tabs: { get: async () => TAB },
      tabGroups: { query: async () => [], update: async () => {} },
    };
    try {
      await expect(
        bindCrawlTab({ tabId: 21, windowId: 5, routineId: "builtin" }),
      ).resolves.toMatchObject({ tabId: 21, windowId: 5, routineId: "builtin" });
    } finally {
      delete globalThis.chrome;
    }
  });

  test("handleUnbindTab reports a thrown unbind", async () => {
    await expect(
      reply(
        handleUnbindTab,
        { tabId: 21 },
        {
          stopKeepalive: () => {
            throw new Error("keepalive failed");
          },
        },
      ),
    ).resolves.toEqual({ success: false, error: "keepalive failed" });
  });

  test("message handlers answer bind and unbind", async () => {
    const next = io();
    await expect(
      reply(handleBindTab, { tabId: 21, payload: { routineId: "hiringcafe", windowId: 5 } }, next),
    ).resolves.toMatchObject({
      success: true,
      result: { tabId: 21, windowId: 5, groupId: 9, routineId: "hiringcafe" },
    });
    await expect(reply(handleUnbindTab, { payload: { tabId: 21 } }, next)).resolves.toEqual({
      success: true,
      result: { removed: true, tabId: 21 },
    });
  });
});

function saveThenUnbind(next) {
  return bindCrawlTab({ tabId: 21, windowId: 5, routineId: "builtin" }, next);
}
