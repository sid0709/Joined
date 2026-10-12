import { afterEach, describe, expect, test } from "bun:test";

import {
  ensureContentScriptInjected,
  isInjectableTabUrl,
  resolveTargetTab,
  sendToContentScript,
} from "./tabs.js";

afterEach(() => {
  delete globalThis.chrome;
});

const PAGE = { id: 4, url: "https://www.builtin.com/jobs", active: true };
const DEVTOOLS = { id: 9, url: "chrome-extension://abc/devtools.html", active: true };

function installChrome({
  getTab = PAGE,
  queryTabs = [PAGE],
  windows = [{ focused: true, tabs: [PAGE] }],
  sendError = null,
  sendResponse = { success: true },
  injectResult = true,
  injectError = null,
} = {}) {
  const queries = [];
  const sent = [];
  const injected = [];
  globalThis.chrome = {
    runtime: { lastError: null },
    tabs: {
      get: async () => getTab,
      query: async (info) => {
        queries.push(info);
        return queryTabs;
      },
      sendMessage: (_tabId, message, _options, callback) => {
        sent.push(message);
        chrome.runtime.lastError = sendError;
        callback(sendError ? undefined : sendResponse);
      },
    },
    windows: {
      getAll: async () => windows,
    },
    scripting: {
      executeScript: async (options) => {
        injected.push(options);
        if (injectError) throw injectError;
        return [{ result: injectResult }];
      },
    },
  };
  return { queries, sent, injected };
}

describe("isInjectableTabUrl", () => {
  test("allows http(s) and file tabs", () => {
    expect(isInjectableTabUrl("https://builtin.com/jobs")).toBe(true);
    expect(isInjectableTabUrl("http://localhost/jobs")).toBe(true);
    expect(isInjectableTabUrl("file:///tmp/jobs.html")).toBe(true);
    expect(isInjectableTabUrl("chrome://extensions")).toBe(false);
    expect(isInjectableTabUrl("")).toBe(false);
    expect(isInjectableTabUrl(null)).toBe(false);
  });
});

describe("resolveTargetTab", () => {
  test("returns an explicit injectable tabId", async () => {
    installChrome();
    await expect(resolveTargetTab({ tabId: 4 })).resolves.toEqual(PAGE);
  });

  test("falls back to the last-focused window after a bad explicit id", async () => {
    const chrome = installChrome();
    globalThis.chrome.tabs.get = async () => {
      throw new Error("No tab");
    };
    await expect(resolveTargetTab({ payload: { tabId: 99 } })).resolves.toEqual(PAGE);
    expect(chrome.queries[0]).toEqual({ active: true, lastFocusedWindow: true });
  });

  test("walks current window then any normal window", async () => {
    installChrome({
      queryTabs: [DEVTOOLS],
      windows: [
        { focused: false, tabs: [DEVTOOLS] },
        { focused: true, tabs: [PAGE] },
      ],
    });
    globalThis.chrome.tabs.query = async (info) => {
      if (info.lastFocusedWindow || info.currentWindow) return [DEVTOOLS];
      return [PAGE];
    };
    await expect(resolveTargetTab({})).resolves.toEqual(PAGE);
  });

  test("returns null when no injectable tab exists", async () => {
    installChrome({
      queryTabs: [DEVTOOLS],
      windows: [{ focused: true, tabs: [DEVTOOLS] }],
    });
    globalThis.chrome.tabs.query = async () => [DEVTOOLS];
    await expect(resolveTargetTab({})).resolves.toBeNull();
  });

  test("returns null when chrome queries throw", async () => {
    installChrome();
    globalThis.chrome.tabs.query = async () => {
      throw new Error("query blocked");
    };
    globalThis.chrome.windows.getAll = async () => {
      throw new Error("windows blocked");
    };
    await expect(resolveTargetTab({})).resolves.toBeNull();
  });
});

describe("sendToContentScript", () => {
  test("resolves with the tab response", async () => {
    const chrome = installChrome({ sendResponse: { success: true, result: { html: "" } } });
    await expect(sendToContentScript(4, { action: "routine:op" })).resolves.toEqual({
      success: true,
      result: { html: "" },
    });
    expect(chrome.sent).toEqual([{ action: "routine:op" }]);
  });

  test("rethrows a send error that is not a missing receiver", async () => {
    installChrome({ sendError: { message: "Tab message failed" } });
    await expect(sendToContentScript(4, { action: "x" })).rejects.toThrow("Tab message failed");
  });

  test("injects the content script and retries when no receiver is listening", async () => {
    let attempts = 0;
    const injected = [];
    globalThis.chrome = {
      runtime: { lastError: null },
      tabs: {
        sendMessage: (_tabId, message, _options, callback) => {
          attempts += 1;
          if (attempts === 1) {
            chrome.runtime.lastError = { message: "Could not establish connection" };
            callback(undefined);
            return;
          }
          chrome.runtime.lastError = null;
          callback({ success: true, result: { retried: true } });
        },
      },
      scripting: {
        executeScript: async (options) => {
          injected.push(options);
          if (options.files) return [{}];
          return [{ result: true }];
        },
      },
    };
    await expect(sendToContentScript(4, { action: "routine:op" })).resolves.toEqual({
      success: true,
      result: { retried: true },
    });
    expect(attempts).toBe(2);
    expect(injected.some((options) => options.files?.[0] === "contentScript.js")).toBe(true);
  });
});

describe("ensureContentScriptInjected", () => {
  test("skips files when the content script is already present", async () => {
    const injected = [];
    globalThis.chrome = {
      scripting: {
        executeScript: async (options) => {
          injected.push(options);
          return [{ result: false }];
        },
      },
    };
    await expect(ensureContentScriptInjected(4)).resolves.toBe(true);
    expect(injected).toHaveLength(1);
  });

  test("returns false when injection throws", async () => {
    globalThis.chrome = {
      scripting: {
        executeScript: async () => {
          throw new Error("blocked");
        },
      },
    };
    await expect(ensureContentScriptInjected(4)).resolves.toBe(false);
  });
});
