import { describe, expect, test } from "bun:test";

import {
  clearFetchWatchInDocument,
  installFetchWatchInDocument,
  readFetchWatchInDocument,
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
      await globalThis.fetch("https://hiringcafe.com/api/updateMarketplaceJobStageForUser");
      await globalThis.fetch("https://hiringcafe.com/api/other");
      expect(readFetchWatchInDocument().hits).toEqual([
        {
          url: "https://hiringcafe.com/api/updateMarketplaceJobStageForUser",
          status: 200,
          body: "Update successful",
        },
      ]);
      expect(clearFetchWatchInDocument()).toEqual({ watching: false, hits: [] });
      expect(globalThis.fetch).toBeDefined();
    } finally {
      globalThis.fetch = original;
    }
  });
});
