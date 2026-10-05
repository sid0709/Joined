import { describe, expect, test } from "bun:test";

import { RUNTIME_MESSAGE } from "../messaging/runtime";
import { requestDetectedJob, shouldRefreshDetectedJob, stateFromCapturedJob } from "./detectedJob";

const job = {
  board: "linkedin" as const,
  title: "Role",
  company: "Acme",
  location: "Remote",
  applyUrl: "https://www.linkedin.com/jobs/view/1",
  description: "Do work",
};

describe("detected job state", () => {
  test("maps captured jobs and navigation messages", () => {
    expect(stateFromCapturedJob(job)).toEqual({ status: "found", job });
    expect(stateFromCapturedJob(null)).toEqual({ status: "empty" });
    expect(shouldRefreshDetectedJob({ type: RUNTIME_MESSAGE.TAB_UPDATED })).toBe(true);
    expect(shouldRefreshDetectedJob({ type: RUNTIME_MESSAGE.TAB_ACTIVATED })).toBe(true);
    expect(shouldRefreshDetectedJob({ type: RUNTIME_MESSAGE.TAB_CLOSED })).toBe(false);
  });

  test("requests a capture from the background", async () => {
    const found = await requestDetectedJob(async () => ({ job }));
    const empty = await requestDetectedJob(async () => ({ job: null }));
    const failed = await requestDetectedJob(async () => {
      throw new Error("closed");
    });
    expect(found).toEqual({ status: "found", job });
    expect(empty).toEqual({ status: "empty" });
    expect(failed).toEqual({ status: "empty" });
  });
});
