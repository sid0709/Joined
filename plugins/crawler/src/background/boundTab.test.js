import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { isBoundTabClosedError } from "../routineKit/protocol.js";

import {
  BOUND_TAB_CLOSED_MESSAGE,
  BOUND_TAB_MISSING_MESSAGE,
  BoundTabError,
  getBoundTab,
  listBoundTabs,
  removeBoundTab,
  resetBoundTabs,
  resolveBoundTab,
  saveBoundTab,
} from "./boundTab.js";

const TAB = { id: 11, url: "https://hiringcafe.com/classic", windowId: 3 };

beforeEach(() => {
  resetBoundTabs();
});

afterEach(() => {
  resetBoundTabs();
  delete globalThis.chrome;
});

describe("bound crawl tab", () => {
  test("persists and lists binds by tabId", () => {
    const stored = [];
    globalThis.chrome = {
      storage: {
        session: {
          set: async (value) => stored.push(value),
        },
      },
    };
    const bind = saveBoundTab({
      tabId: 11,
      windowId: 3,
      groupId: 8,
      routineId: "hiringcafe",
    });
    expect(bind).toEqual({ tabId: 11, windowId: 3, groupId: 8, routineId: "hiringcafe" });
    expect(getBoundTab(11)).toEqual(bind);
    expect(listBoundTabs()).toEqual([bind]);
    expect(removeBoundTab(11)).toBe(true);
    expect(getBoundTab(11)).toBeNull();
    expect(stored.length).toBeGreaterThan(0);
  });

  test("rejects a missing tabId", () => {
    expect(() => saveBoundTab({})).toThrow(BOUND_TAB_MISSING_MESSAGE);
  });

  test("resolves only the named tabId and never queries the active tab", async () => {
    const queries = [];
    const tabs = {
      get: async (tabId) => {
        queries.push(tabId);
        return { ...TAB, id: tabId };
      },
      query: async () => {
        throw new Error("must not query active tabs");
      },
    };
    await expect(resolveBoundTab({ tabId: 11 }, tabs)).resolves.toEqual(TAB);
    await expect(resolveBoundTab({ payload: { tabId: 11 } }, tabs)).resolves.toEqual(TAB);
    expect(queries).toEqual([11, 11]);
  });

  test("throws a closed-tab error when the bound tab is gone", async () => {
    saveBoundTab({ tabId: 11, windowId: 3, routineId: "hiringcafe" });
    const tabs = {
      get: async () => {
        throw new Error("No tab with id: 11");
      },
    };
    await expect(resolveBoundTab({ tabId: 11 }, tabs)).rejects.toMatchObject({
      name: "BoundTabError",
      message: BOUND_TAB_CLOSED_MESSAGE,
      closed: true,
    });
    expect(getBoundTab(11)).toBeNull();
    expect(isBoundTabClosedError(new BoundTabError())).toBe(true);
    expect(isBoundTabClosedError(new Error(BOUND_TAB_MISSING_MESSAGE))).toBe(true);
    expect(
      isBoundTabClosedError(
        new Error("Could not establish connection. Receiving end does not exist."),
      ),
    ).toBe(true);
    expect(isBoundTabClosedError(new Error("other"))).toBe(false);
  });

  test("throws when no tabId is bound on the message", async () => {
    await expect(resolveBoundTab({}, { get: async () => TAB })).rejects.toThrow(
      BOUND_TAB_MISSING_MESSAGE,
    );
  });

  test("rejects a non-injectable bound tab url", async () => {
    saveBoundTab({ tabId: 9, routineId: "builtin" });
    await expect(
      resolveBoundTab({ tabId: 9 }, { get: async () => ({ id: 9, url: "chrome://extensions" }) }),
    ).rejects.toThrow(BOUND_TAB_CLOSED_MESSAGE);
    expect(getBoundTab(9)).toBeNull();
  });
});
