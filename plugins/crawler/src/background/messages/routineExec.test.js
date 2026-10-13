import { describe, expect, test } from "bun:test";

import {
  BOUND_TAB_CLOSED_MESSAGE,
  BOUND_TAB_MISSING_MESSAGE,
  NAVIGATE_UNTIL_DOM_READY,
  ROUTINE_OP_ACTION,
} from "../../routineKit/protocol.js";
import { BUILTIN_HOSTS } from "../../routines/builtin/constants.js";
import { BoundTabError } from "../boundTab.js";

import { handleRoutineExec } from "./routineExec.js";

const BUILTIN_TAB = { id: 4, url: "https://www.builtin.com/jobs" };
const OTHER_TAB = { id: 8, url: "https://jobright.ai/jobs" };

function exec(message, io) {
  return new Promise((resolve) => {
    handleRoutineExec(message, resolve, io);
  });
}

function io(overrides = {}) {
  return {
    resolveBoundTab: async () => BUILTIN_TAB,
    sendToContentScript: async () => ({ success: true, result: { isolated: true } }),
    navigateTab: async () => ({ url: "https://www.builtin.com/jobs?page=2" }),
    abortInFlightNavigate: () => {},
    clickShadowInMainWorld: async () => ({ found: true, clicked: true, which: "heart" }),
    installFetchWatchInMainWorld: async () => ({ watching: true, hits: [] }),
    readFetchWatchInMainWorld: async () => ({ hits: [] }),
    clearFetchWatchInMainWorld: async () => ({ watching: false, hits: [] }),
    dispatchTrustedMouse: async () => ({ found: true, hovered: true }),
    ensureDebugger: async () => ({ attached: true, reused: false }),
    releaseDebugger: async () => ({ detached: true }),
    ...overrides,
  };
}

describe("handleRoutineExec", () => {
  test("fails when the bound tab is missing", async () => {
    await expect(exec({ payload: {} }, io({ resolveBoundTab: async () => null }))).resolves.toEqual(
      {
        success: false,
        error: BOUND_TAB_MISSING_MESSAGE,
      },
    );
  });

  test("detaches the debugger when Stop runs after the tab is gone", async () => {
    const released = [];
    await expect(
      exec(
        { tabId: 9, payload: { op: "detachDebugger" } },
        io({
          resolveBoundTab: async () => {
            throw new BoundTabError(BOUND_TAB_CLOSED_MESSAGE);
          },
          releaseDebugger: async (tabId) => {
            released.push(tabId);
            return { detached: true, tabId };
          },
        }),
      ),
    ).resolves.toEqual({ success: true, result: { detached: true, tabId: 9 } });
    expect(released).toEqual([9]);
  });

  test("stops cleanly when the bound tab was closed", async () => {
    await expect(
      exec(
        { tabId: 9, payload: { op: "html" } },
        io({
          resolveBoundTab: async () => {
            throw new BoundTabError(BOUND_TAB_CLOSED_MESSAGE);
          },
        }),
      ),
    ).resolves.toEqual({
      success: false,
      error: BOUND_TAB_CLOSED_MESSAGE,
      closed: true,
    });
  });

  test("sleeps in the service worker so background tabs keep timers", async () => {
    const slept = [];
    await expect(
      exec(
        { payload: { op: "sleep", ms: 25 } },
        io({
          handleSleep: async (payload) => {
            slept.push(payload.ms);
            return { slept: true, ms: payload.ms };
          },
        }),
      ),
    ).resolves.toEqual({ success: true, result: { slept: true, ms: 25 } });
    expect(slept).toEqual([25]);
  });

  test("navigates the bound tab", async () => {
    const calls = [];
    const result = await exec(
      {
        payload: {
          op: "navigate",
          url: "https://builtin.com/jobs?page=2",
          timeout: 9,
          until: NAVIGATE_UNTIL_DOM_READY,
        },
      },
      io({
        navigateTab: async (tabId, url, timeout, until) => {
          calls.push({ tabId, url, timeout, until });
          return { url };
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { url: "https://builtin.com/jobs?page=2" } });
    expect(calls).toEqual([
      {
        tabId: 4,
        url: "https://builtin.com/jobs?page=2",
        timeout: 9,
        until: NAVIGATE_UNTIL_DOM_READY,
      },
    ]);
  });

  test("clicks the heart in the MAIN world on Built In", async () => {
    const clicks = [];
    const result = await exec(
      {
        payload: {
          op: "shadow",
          action: "click",
          host: "my-item",
          inner: "div.heart",
          which: "heart",
        },
      },
      io({
        clickShadowInMainWorld: async (tabId, payload) => {
          clicks.push({ tabId, payload });
          return { found: true, clicked: true, which: "heart" };
        },
      }),
    );
    expect(result).toEqual({
      success: true,
      result: { found: true, clicked: true, which: "heart" },
    });
    expect(clicks).toEqual([
      {
        tabId: 4,
        payload: {
          op: "shadow",
          action: "click",
          host: "my-item",
          inner: "div.heart",
          which: "heart",
        },
      },
    ]);
  });

  test("falls back to the isolated world when the MAIN-world click throws", async () => {
    const isolated = [];
    const result = await exec(
      { payload: { op: "shadow", action: "click", host: "my-item", hosts: BUILTIN_HOSTS } },
      io({
        clickShadowInMainWorld: async () => {
          throw new Error("MAIN world blocked");
        },
        sendToContentScript: async (tabId, message) => {
          isolated.push({ tabId, message });
          return { success: true, result: { found: true, clicked: true } };
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { found: true, clicked: true } });
    expect(isolated).toEqual([
      {
        tabId: 4,
        message: {
          action: ROUTINE_OP_ACTION,
          payload: { op: "shadow", action: "click", host: "my-item", hosts: BUILTIN_HOSTS },
        },
      },
    ]);
  });

  test("allows a shadow op when payload hosts match the tab", async () => {
    await expect(
      exec(
        { payload: { op: "shadow", action: "click", hosts: ["jobright.ai"] } },
        io({ resolveBoundTab: async () => OTHER_TAB }),
      ),
    ).resolves.toEqual({ success: true, result: { found: true, clicked: true, which: "heart" } });
  });

  test("rejects a shadow op off builtin.com", async () => {
    await expect(
      exec(
        { payload: { op: "shadow", action: "click" } },
        io({ resolveBoundTab: async () => OTHER_TAB }),
      ),
    ).resolves.toEqual({ success: false, error: "Shadow ops are limited to Built In" });
  });

  test("rejects debugger attach when the tab URL is not a URL", async () => {
    await expect(
      exec(
        { payload: { op: "attachDebugger" } },
        io({ resolveBoundTab: async () => ({ id: 1, url: "not-a-url" }) }),
      ),
    ).resolves.toEqual({ success: false, error: "Debugger attach is limited to HiringCafe" });
  });

  test("rejects a shadow op when the tab URL is not a URL", async () => {
    await expect(
      exec(
        { payload: { op: "shadow", action: "query" } },
        io({ resolveBoundTab: async () => ({ id: 1, url: "not-a-url" }) }),
      ),
    ).resolves.toEqual({ success: false, error: "Shadow ops are limited to Built In" });
  });

  test("relays a non-click shadow op to the content script", async () => {
    const result = await exec(
      { payload: { op: "shadow", action: "query", host: "my-item" } },
      io(),
    );
    expect(result).toEqual({ success: true, result: { isolated: true } });
  });

  test("aborts in-flight navigates then runs the page op", async () => {
    const aborted = [];
    const released = [];
    const result = await exec(
      { payload: { op: "abortFetches" } },
      io({
        abortInFlightNavigate: () => aborted.push(true),
        releaseDebugger: async (tabId) => {
          released.push(tabId);
          return { detached: true };
        },
        sendToContentScript: async () => ({ success: true, result: { aborted: true } }),
      }),
    );
    expect(aborted).toEqual([true]);
    expect(released).toEqual([4]);
    expect(result).toEqual({ success: true, result: { aborted: true } });
  });

  test("opens job tabs beside the crawl tab and Stop closes them", async () => {
    const opened = [];
    const closed = [];
    const tabsIo = {
      resolveBoundTab: async () => ({ id: 3, url: "https://hiringcafe.com/classic", windowId: 2 }),
      openDetailTabs: async (owner, payload) => {
        opened.push({ owner: owner.id, urls: payload.urls });
        return { pages: [] };
      },
      closeDetailTabs: async (tabId) => closed.push(tabId),
      releaseDebugger: async () => ({ detached: true }),
      sendToContentScript: async () => ({ success: true, result: { aborted: true } }),
    };
    const result = await exec(
      { payload: { op: "openDetailTabs", urls: ["https://hiringcafe.com/job/a-1"] } },
      io(tabsIo),
    );
    expect(result).toEqual({ success: true, result: { pages: [] } });
    expect(opened).toEqual([{ owner: 3, urls: ["https://hiringcafe.com/job/a-1"] }]);
    await exec({ payload: { op: "abortFetches" } }, io(tabsIo));
    expect(closed).toEqual([3]);
  });

  test("closes job tabs even when closing or releasing the debugger fails", async () => {
    const closed = [];
    const failing = {
      closeDetailTabs: async (tabId) => {
        closed.push(tabId);
        throw new Error("tabs gone");
      },
      releaseDebugger: async () => {
        throw new Error("debugger gone");
      },
    };
    const gone = await exec(
      { tabId: 9, payload: { op: "abortFetches" } },
      io({
        ...failing,
        resolveBoundTab: async () => {
          throw new BoundTabError("The crawl tab was closed. The run stopped.");
        },
      }),
    );
    expect(gone).toEqual({ success: true, result: { detached: true } });
    const live = await exec(
      { payload: { op: "abortFetches" } },
      io({
        ...failing,
        sendToContentScript: async () => ({ success: true, result: { aborted: true } }),
      }),
    );
    expect(live).toEqual({ success: true, result: { aborted: true } });
    expect(closed).toEqual([9, 4]);
  });

  test("attaches the debugger on HiringCafe only", async () => {
    const attached = [];
    const result = await exec(
      { payload: { op: "attachDebugger" } },
      io({
        resolveBoundTab: async () => ({ id: 3, url: "https://hiringcafe.com/classic" }),
        ensureDebugger: async (tabId) => {
          attached.push(tabId);
          return { attached: true, reused: false };
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { attached: true, reused: false } });
    expect(attached).toEqual([3]);
    await expect(exec({ payload: { op: "attachDebugger" } }, io())).resolves.toEqual({
      success: false,
      error: "Debugger attach is limited to HiringCafe",
    });
  });

  test("detaches the debugger session", async () => {
    const result = await exec(
      { payload: { op: "detachDebugger" } },
      io({
        resolveBoundTab: async () => ({ id: 3, url: "https://hiringcafe.com/classic" }),
        releaseDebugger: async (tabId) => ({ detached: true, tabId }),
      }),
    );
    expect(result).toEqual({ success: true, result: { detached: true, tabId: 3 } });
  });

  test("answers with a page-timeout when the content script is silent", async () => {
    await expect(
      exec({ payload: { op: "html" } }, io({ sendToContentScript: async () => null })),
    ).resolves.toEqual({
      success: false,
      error: "The page did not answer the routine op",
    });
  });

  test("reads and clears a MAIN-world fetch watch on HiringCafe", async () => {
    const hiring = { id: 3, url: "https://hiringcafe.com/classic" };
    await expect(
      exec(
        { payload: { op: "watchedFetches" } },
        io({
          resolveBoundTab: async () => hiring,
          readFetchWatchInMainWorld: async (tabId) => ({ hits: [{ tabId }] }),
        }),
      ),
    ).resolves.toEqual({ success: true, result: { hits: [{ tabId: 3 }] } });
    await expect(
      exec(
        { payload: { op: "unwatchFetch" } },
        io({
          resolveBoundTab: async () => hiring,
          clearFetchWatchInMainWorld: async () => ({ watching: false, hits: [] }),
        }),
      ),
    ).resolves.toEqual({ success: true, result: { watching: false, hits: [] } });
  });

  test("installs a MAIN-world fetch watch on HiringCafe", async () => {
    const calls = [];
    const result = await exec(
      { payload: { op: "watchFetch", urlIncludes: "/api/updateMarketplaceJobStageForUser" } },
      io({
        resolveBoundTab: async () => ({ id: 3, url: "https://hiringcafe.com/classic" }),
        installFetchWatchInMainWorld: async (tabId, payload) => {
          calls.push({ tabId, payload });
          return { watching: true, hits: [] };
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { watching: true, hits: [] } });
    expect(calls).toEqual([
      {
        tabId: 3,
        payload: { op: "watchFetch", urlIncludes: "/api/updateMarketplaceJobStageForUser" },
      },
    ]);
  });

  test("dispatches trusted debugger mouse on HiringCafe hoverClick", async () => {
    const calls = [];
    const result = await exec(
      {
        payload: {
          op: "hoverClick",
          selector: ".card",
          clickSelector: ".mark",
          offsets: [{ x: 100, y: 100 }],
        },
      },
      io({
        resolveBoundTab: async () => ({ id: 3, url: "https://hiringcafe.com/classic" }),
        dispatchTrustedMouse: async (tabId, payload) => {
          calls.push({ tabId, payload });
          return { found: true, hovered: true };
        },
        sendToContentScript: async () => {
          throw new Error("synthetic hover must not run on HiringCafe");
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { found: true, hovered: true } });
    expect(calls).toEqual([
      {
        tabId: 3,
        payload: {
          op: "hoverClick",
          selector: ".card",
          clickSelector: ".mark",
          offsets: [{ x: 100, y: 100 }],
        },
      },
    ]);
  });

  test("does not fall back to synthetic hover after a trusted press", async () => {
    const isolated = [];
    const error = new Error("release failed after press");
    error.pressed = true;
    const result = await exec(
      { payload: { op: "hoverClick", selector: ".card" } },
      io({
        resolveBoundTab: async () => ({ id: 3, url: "https://hiringcafe.com/classic" }),
        dispatchTrustedMouse: async () => {
          throw error;
        },
        sendToContentScript: async () => {
          isolated.push("synthetic");
          return { success: true, result: { found: true, pressed: false } };
        },
      }),
    );
    expect(result).toEqual({
      success: true,
      result: { found: true, hovered: true, pressed: true },
    });
    expect(isolated).toEqual([]);
  });

  test("falls back to the content script when trusted mouse throws", async () => {
    const isolated = [];
    const result = await exec(
      { payload: { op: "hover", selector: ".card", x: 100, y: 100 } },
      io({
        resolveBoundTab: async () => ({ id: 3, url: "https://hiring.cafe/classic" }),
        dispatchTrustedMouse: async () => {
          throw new Error("debugger denied");
        },
        sendToContentScript: async (tabId, message) => {
          isolated.push({ tabId, message });
          return { success: true, result: { found: true } };
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { found: true } });
    expect(isolated[0].tabId).toBe(3);
    expect(isolated[0].message.payload.op).toBe("hover");
  });

  test("keeps synthetic hover off HiringCafe", async () => {
    const isolated = [];
    await exec(
      { payload: { op: "hover", selector: ".card" } },
      io({
        dispatchTrustedMouse: async () => {
          throw new Error("HiringCafe-only");
        },
        sendToContentScript: async (_tabId, message) => {
          isolated.push(message.payload.op);
          return { success: true, result: { found: true } };
        },
      }),
    );
    expect(isolated).toEqual(["hover"]);
  });

  test("rejects fetch watch off HiringCafe", async () => {
    await expect(exec({ payload: { op: "watchFetch" } }, io())).resolves.toEqual({
      success: false,
      error: "Fetch watch is limited to HiringCafe",
    });
  });

  test("surfaces a navigate throw after the tab resolves", async () => {
    await expect(
      exec(
        { payload: { op: "navigate", url: "https://builtin.com/jobs?page=2" } },
        io({
          navigateTab: async () => {
            throw new Error("navigate exploded");
          },
        }),
      ),
    ).resolves.toEqual({ success: false, error: "navigate exploded" });
  });

  test("surfaces an unexpected handler error", async () => {
    await expect(
      exec(
        { payload: {} },
        io({
          resolveBoundTab: async () => {
            throw new Error("tab gone");
          },
        }),
      ),
    ).resolves.toEqual({ success: false, error: "tab gone", closed: false });
  });
});
