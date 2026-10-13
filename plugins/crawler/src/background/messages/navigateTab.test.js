import { afterEach, describe, expect, test } from "bun:test";

import {
  abortInFlightNavigate,
  DEFAULT_NAVIGATE_TIMEOUT_MS,
  navigateTab,
  sameTabUrl,
} from "./navigateTab.js";

const TAB_ID = 7;
const OTHER_TAB_ID = 8;
const LIST_URL = "https://builtin.com/jobs?page=2";
const JOB_URL = "https://builtin.com/job/staff/9256204";
const OTHER_JOB_URL = "https://builtin.com/job/other/11111111";
const SHORT_TIMEOUT_MS = 40;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function installChrome({ url = LIST_URL, fireComplete = true, completeDelayMs = 0 } = {}) {
  const listeners = new Set();
  const tab = { id: TAB_ID, url, status: "complete" };
  const updates = [];
  const notify = (id, info) => {
    for (const listener of [...listeners]) listener(id, info, { ...tab });
  };
  globalThis.chrome = {
    tabs: {
      get: async (id) => {
        if (id !== tab.id) throw new Error("No tab");
        return { ...tab };
      },
      update: async (id, props) => {
        updates.push({ id, ...props });
        Object.assign(tab, props);
        tab.status = "loading";
        const finish = () => {
          if (!fireComplete) return;
          tab.status = "complete";
          notify(OTHER_TAB_ID, { status: "complete" });
          notify(id, { status: "loading" });
          notify(id, { status: "complete" });
        };
        if (completeDelayMs > 0) setTimeout(finish, completeDelayMs);
        else queueMicrotask(finish);
        return { ...tab };
      },
      onUpdated: {
        addListener: (fn) => listeners.add(fn),
        removeListener: (fn) => listeners.delete(fn),
      },
    },
  };
  return { tab, updates, listeners };
}

afterEach(() => {
  abortInFlightNavigate();
  delete globalThis.chrome;
});

describe("sameTabUrl", () => {
  test("ignores a trailing slash and a hash", () => {
    expect(sameTabUrl("https://builtin.com/jobs", "https://builtin.com/jobs/")).toBe(true);
    expect(sameTabUrl("https://builtin.com/jobs?page=2", "https://builtin.com/jobs?page=2#x")).toBe(
      true,
    );
    expect(sameTabUrl("https://builtin.com/jobs", "https://builtin.com/jobs?page=2")).toBe(false);
  });

  test("compares invalid URLs as raw strings", () => {
    expect(sameTabUrl("not a url", "not a url")).toBe(true);
    expect(sameTabUrl("not a url", "also-not")).toBe(false);
  });
});

describe("navigateTab", () => {
  test("keeps the named hang timeout", () => {
    expect(DEFAULT_NAVIGATE_TIMEOUT_MS).toBe(15_000);
  });

  test("does not reload when the tab is already on the url", async () => {
    const chrome = installChrome({ url: `${LIST_URL}#top` });
    await expect(navigateTab(TAB_ID, LIST_URL)).resolves.toEqual({ url: `${LIST_URL}#top` });
    expect(chrome.updates).toEqual([]);
  });

  test("updates the same tab and waits until it finishes loading", async () => {
    const chrome = installChrome({ completeDelayMs: 5 });
    await expect(navigateTab(TAB_ID, JOB_URL, SHORT_TIMEOUT_MS)).resolves.toEqual({ url: JOB_URL });
    expect(chrome.updates).toEqual([{ id: TAB_ID, url: JOB_URL }]);
    expect(chrome.listeners.size).toBe(0);
  });

  test("times out when the page never completes", async () => {
    installChrome({ fireComplete: false });
    await expect(navigateTab(TAB_ID, JOB_URL, SHORT_TIMEOUT_MS)).rejects.toThrow(
      `Page op "navigate" timed out after ${SHORT_TIMEOUT_MS} ms`,
    );
  });

  test("rejects an in-flight navigate when Stop aborts it", async () => {
    installChrome({ fireComplete: false });
    const pending = navigateTab(TAB_ID, JOB_URL, 500);
    await delay(5);
    abortInFlightNavigate();
    await expect(pending).rejects.toThrow("Routine stopped");
  });

  test("abort is a no-op when nothing is in flight", () => {
    expect(() => abortInFlightNavigate()).not.toThrow();
  });

  test("a later navigate on the same tab aborts the earlier one", async () => {
    installChrome({ fireComplete: false });
    const first = navigateTab(TAB_ID, JOB_URL, 500);
    await delay(5);
    installChrome({ url: LIST_URL, fireComplete: true });
    const second = navigateTab(TAB_ID, OTHER_JOB_URL, SHORT_TIMEOUT_MS);
    await expect(first).rejects.toThrow("Routine stopped");
    await expect(second).resolves.toEqual({ url: OTHER_JOB_URL });
  });

  test("concurrent navigates in separate tabs do not abort each other", async () => {
    const listeners = new Set();
    const tabs = {
      [TAB_ID]: { id: TAB_ID, url: LIST_URL, status: "complete" },
      [OTHER_TAB_ID]: { id: OTHER_TAB_ID, url: LIST_URL, status: "complete" },
    };
    const updates = [];
    globalThis.chrome = {
      tabs: {
        get: async (id) => {
          if (!tabs[id]) throw new Error("No tab");
          return { ...tabs[id] };
        },
        update: async (id, props) => {
          updates.push({ id, ...props });
          Object.assign(tabs[id], props);
          tabs[id].status = "loading";
          setTimeout(() => {
            tabs[id].status = "complete";
            for (const listener of [...listeners])
              listener(id, { status: "complete" }, { ...tabs[id] });
          }, 5);
          return { ...tabs[id] };
        },
        onUpdated: {
          addListener: (fn) => listeners.add(fn),
          removeListener: (fn) => listeners.delete(fn),
        },
      },
    };
    const [first, second] = await Promise.all([
      navigateTab(TAB_ID, JOB_URL, SHORT_TIMEOUT_MS),
      navigateTab(OTHER_TAB_ID, OTHER_JOB_URL, SHORT_TIMEOUT_MS),
    ]);
    expect(first).toEqual({ url: JOB_URL });
    expect(second).toEqual({ url: OTHER_JOB_URL });
    expect(updates).toEqual([
      { id: TAB_ID, url: JOB_URL },
      { id: OTHER_TAB_ID, url: OTHER_JOB_URL },
    ]);
  });
});
