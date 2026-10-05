import { describe, expect, test } from "bun:test";

import { RUNTIME_MESSAGE } from "../messaging/runtime";
import { captureTabJob, handleCaptureTabRequest, queryActiveTab } from "./capture-tab";

const job = {
  board: "greenhouse" as const,
  title: "Role",
  company: "Acme",
  location: "Remote",
  applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
  description: "Do work",
};

describe("captureTabJob", () => {
  test("injects the content script and returns a captured job", async () => {
    const injectCalls: number[] = [];
    const captured = await captureTabJob(
      { id: 9, url: "https://boards.greenhouse.io/acme/jobs/1" },
      {
        inject: async (tabId) => {
          injectCalls.push(tabId);
        },
        send: async () => ({ job }),
      },
    );
    expect(injectCalls).toEqual([9]);
    expect(captured).toEqual(job);
  });

  test("returns null for restricted urls, missing tabs, and inject failures", async () => {
    expect(
      await captureTabJob(
        { id: 1, url: "chrome://extensions" },
        {
          inject: async () => undefined,
          send: async () => ({ job }),
        },
      ),
    ).toBeNull();
    expect(
      await captureTabJob(
        { id: 2, url: "https://jobs.lever.co/acme/1" },
        {
          inject: async () => {
            throw new Error("blocked");
          },
          send: async () => ({ job }),
        },
      ),
    ).toBeNull();
    expect(await queryActiveTab(async () => [])).toBeNull();
    expect(await queryActiveTab(async () => [{ url: "https://example.test" }])).toBeNull();
    expect(
      await queryActiveTab(async () => [{ id: 4, url: "https://jobs.ashbyhq.com/a/1" }]),
    ).toEqual({
      id: 4,
      url: "https://jobs.ashbyhq.com/a/1",
    });
    expect(
      await handleCaptureTabRequest({ type: "other" }, async () => [{ id: 1 }], {
        inject: async () => undefined,
        send: async () => ({ job }),
      }),
    ).toBeNull();
    expect(
      await handleCaptureTabRequest({ type: RUNTIME_MESSAGE.CAPTURE_TAB }, async () => [], {
        inject: async () => undefined,
        send: async () => ({ job }),
      }),
    ).toBeNull();
    expect(
      await handleCaptureTabRequest(
        { type: RUNTIME_MESSAGE.CAPTURE_TAB },
        async () => [{ id: 8, url: "https://jobs.lever.co/acme/1" }],
        {
          inject: async () => undefined,
          send: async () => ({ job }),
        },
      ),
    ).toEqual(job);
  });
});
