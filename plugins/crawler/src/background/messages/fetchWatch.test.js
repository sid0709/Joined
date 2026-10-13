import { describe, expect, test } from "bun:test";

import {
  clearFetchWatchInDocument,
  clearFetchWatchInMainWorld,
  installFetchWatchInDocument,
  installFetchWatchInMainWorld,
  readFetchWatchInDocument,
  readFetchWatchInMainWorld,
} from "./fetchWatch.js";

describe("fetchWatch", () => {
  test("records matching fetch responses and restores window.fetch", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url) => ({
      status: 200,
      clone() {
        return {
          async text() {
            return "Update successful";
          },
        };
      },
      url,
    });
    try {
      expect(installFetchWatchInDocument("/api/updateMarketplaceJobStageForUser")).toMatchObject({
        watching: true,
      });
      await globalThis.fetch("https://hiringcafe.com/api/updateMarketplaceJobStageForUser", {
        body: '{"requisition_id":"reqaaa1111111111"}',
      });
      await globalThis.fetch("https://hiringcafe.com/api/other");
      expect(readFetchWatchInDocument().hits).toEqual([
        {
          url: "https://hiringcafe.com/api/updateMarketplaceJobStageForUser",
          status: 200,
          body: "Update successful",
          request: '{"requisition_id":"reqaaa1111111111"}',
        },
      ]);
      expect(installFetchWatchInDocument("/api/updateMarketplaceJobStageForUser")).toMatchObject({
        watching: true,
      });
      expect(clearFetchWatchInDocument()).toEqual({ watching: false, hits: [] });
      expect(globalThis.fetch).toBeDefined();
    } finally {
      globalThis.fetch = original;
    }
  });

  test("records every fetch when the filter is empty and survives a clone error", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url) => ({
      status: 204,
      clone() {
        throw new Error("closed");
      },
      url,
    });
    try {
      expect(installFetchWatchInDocument("")).toMatchObject({ watching: true });
      await globalThis.fetch({ url: "https://hiringcafe.com/api/other" });
      expect(readFetchWatchInDocument().hits).toEqual([
        { url: "https://hiringcafe.com/api/other", status: 204, body: "", request: "" },
      ]);
      expect(clearFetchWatchInDocument()).toEqual({ watching: false, hits: [] });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("does nothing when window.fetch is missing", () => {
    const original = globalThis.fetch;
    globalThis.fetch = undefined;
    try {
      expect(installFetchWatchInDocument("/api")).toEqual({ watching: false, hits: [] });
      expect(readFetchWatchInDocument()).toEqual({ hits: [] });
      expect(clearFetchWatchInDocument()).toEqual({ watching: false, hits: [] });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("installs, reads, and clears a MAIN-world watch", async () => {
    const originalChrome = globalThis.chrome;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => ({
      status: 200,
      clone() {
        return {
          async text() {
            return "ok";
          },
        };
      },
      url,
    });
    globalThis.chrome = {
      scripting: {
        executeScript: async (options) => {
          const result = options.func(...(options.args || []));
          return [{ result }];
        },
      },
    };
    try {
      expect(await installFetchWatchInMainWorld(3, { urlIncludes: "/api" })).toMatchObject({
        watching: true,
      });
      expect(await readFetchWatchInMainWorld(3)).toEqual({ hits: [] });
      expect(await clearFetchWatchInMainWorld(3)).toEqual({ watching: false, hits: [] });
      globalThis.chrome.scripting.executeScript = async () => [{ result: undefined }];
      expect(await installFetchWatchInMainWorld(3, {})).toEqual({ watching: false, hits: [] });
      expect(await readFetchWatchInMainWorld(3)).toEqual({ hits: [] });
      expect(await clearFetchWatchInMainWorld(3)).toEqual({ watching: false, hits: [] });
    } finally {
      globalThis.chrome = originalChrome;
      globalThis.fetch = originalFetch;
    }
  });
});
