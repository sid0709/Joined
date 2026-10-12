import { describe, expect, test } from "bun:test";

import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";
import { BUILTIN_HOSTS } from "../../routines/builtin/constants.js";

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
    resolveTargetTab: async () => BUILTIN_TAB,
    sendToContentScript: async () => ({ success: true, result: { isolated: true } }),
    navigateTab: async () => ({ url: "https://www.builtin.com/jobs?page=2" }),
    abortInFlightNavigate: () => {},
    clickShadowInMainWorld: async () => ({ found: true, clicked: true, which: "heart" }),
    ...overrides,
  };
}

describe("handleRoutineExec", () => {
  test("fails when no page tab is focused", async () => {
    await expect(
      exec({ payload: {} }, io({ resolveTargetTab: async () => null })),
    ).resolves.toEqual({
      success: false,
      error: "No page tab found. Focus the site and try again.",
    });
  });

  test("navigates the focused tab", async () => {
    const calls = [];
    const result = await exec(
      { payload: { op: "navigate", url: "https://builtin.com/jobs?page=2", timeout: 9 } },
      io({
        navigateTab: async (tabId, url, timeout) => {
          calls.push({ tabId, url, timeout });
          return { url };
        },
      }),
    );
    expect(result).toEqual({ success: true, result: { url: "https://builtin.com/jobs?page=2" } });
    expect(calls).toEqual([{ tabId: 4, url: "https://builtin.com/jobs?page=2", timeout: 9 }]);
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
        io({ resolveTargetTab: async () => OTHER_TAB }),
      ),
    ).resolves.toEqual({ success: true, result: { found: true, clicked: true, which: "heart" } });
  });

  test("rejects a shadow op off builtin.com", async () => {
    await expect(
      exec(
        { payload: { op: "shadow", action: "click" } },
        io({ resolveTargetTab: async () => OTHER_TAB }),
      ),
    ).resolves.toEqual({ success: false, error: "Shadow ops are limited to Built In" });
  });

  test("rejects a shadow op when the tab URL is not a URL", async () => {
    await expect(
      exec(
        { payload: { op: "shadow", action: "query" } },
        io({ resolveTargetTab: async () => ({ id: 1, url: "not-a-url" }) }),
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
    const result = await exec(
      { payload: { op: "abortFetches" } },
      io({
        abortInFlightNavigate: () => aborted.push(true),
        sendToContentScript: async () => ({ success: true, result: { aborted: true } }),
      }),
    );
    expect(aborted).toEqual([true]);
    expect(result).toEqual({ success: true, result: { aborted: true } });
  });

  test("answers with a page-timeout when the content script is silent", async () => {
    await expect(
      exec({ payload: { op: "html" } }, io({ sendToContentScript: async () => null })),
    ).resolves.toEqual({
      success: false,
      error: "The page did not answer the routine op",
    });
  });

  test("surfaces an unexpected handler error", async () => {
    await expect(
      exec(
        { payload: {} },
        io({
          resolveTargetTab: async () => {
            throw new Error("tab gone");
          },
        }),
      ),
    ).resolves.toEqual({ success: false, error: "tab gone" });
  });
});
