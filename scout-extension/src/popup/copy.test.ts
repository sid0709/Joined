import { describe, expect, test } from "bun:test";

import { COPY, detectedJobHeading, jobBoardLabel, jobMetaLine, previewText } from "./copy";

const job = {
  board: "workday" as const,
  title: "Staff Software Engineer",
  company: "Acme",
  location: "San Francisco, CA",
  applyUrl: "https://acme.wd5.myworkdayjobs.com/job/1",
  description: "Build the platform.",
};

describe("detected job copy", () => {
  test("formats board labels, meta, and previews", () => {
    expect(jobBoardLabel("greenhouse")).toBe("Greenhouse");
    expect(jobBoardLabel("lever")).toBe("Lever");
    expect(jobBoardLabel("ashby")).toBe("Ashby");
    expect(jobBoardLabel("workday")).toBe("Workday");
    expect(jobBoardLabel("linkedin")).toBe("LinkedIn");
    expect(jobBoardLabel("unknown")).toBe("Job page");
    expect(jobMetaLine(job)).toBe("Acme · San Francisco, CA");
    expect(jobMetaLine({ company: "Acme", location: "" })).toBe("Acme");
    expect(previewText("short")).toBe("short");
    expect(previewText("x".repeat(300)).endsWith("…")).toBe(true);
    expect(detectedJobHeading({ status: "loading" })).toBe(COPY.LOOKING_FOR_JOB);
    expect(detectedJobHeading({ status: "empty" })).toBe(COPY.NO_JOB_FOUND);
    expect(detectedJobHeading({ status: "found", job })).toBe(COPY.DETECTED_JOB);
  });
});
