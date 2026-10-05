import { describe, expect, test } from "bun:test";

import type { JobDraft } from "../drafts/types";
import {
  COPY,
  detectedJobHeading,
  detectedJobSaveLabel,
  draftStatusBadgeVariant,
  draftStatusLabel,
  jobBoardLabel,
  jobMetaLine,
  previewText,
  submitActionLabel,
} from "./copy";

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
    expect(jobBoardLabel("smartrecruiters")).toBe("SmartRecruiters");
    expect(jobBoardLabel("icims")).toBe("iCIMS");
    expect(jobBoardLabel("workable")).toBe("Workable");
    expect(jobBoardLabel("bamboohr")).toBe("BambooHR");
    expect(jobBoardLabel("jobvite")).toBe("Jobvite");
    expect(jobBoardLabel("recruitee")).toBe("Recruitee");
    expect(jobBoardLabel("unknown")).toBe("Job page");
    expect(jobMetaLine(job)).toBe("Acme · San Francisco, CA");
    expect(jobMetaLine({ company: "Acme", location: "" })).toBe("Acme");
    expect(previewText("short")).toBe("short");
    expect(previewText("x".repeat(300)).endsWith("…")).toBe(true);
    expect(detectedJobHeading({ status: "loading" })).toBe(COPY.LOOKING_FOR_JOB);
    expect(detectedJobHeading({ status: "empty" })).toBe(COPY.NO_JOB_FOUND);
    expect(detectedJobHeading({ status: "found", job })).toBe(COPY.DETECTED_JOB);
    expect(detectedJobSaveLabel(false)).toBe(COPY.SAVE_TO_DRAFTS);
    expect(detectedJobSaveLabel(true)).toBe(COPY.IN_DRAFTS);
    expect(draftStatusLabel("draft")).toBe(COPY.STATUS_DRAFT);
    expect(draftStatusLabel("submitting")).toBe(COPY.STATUS_SUBMITTING);
    expect(draftStatusLabel("submitted")).toBe(COPY.STATUS_SUBMITTED);
    expect(draftStatusLabel("failed")).toBe(COPY.STATUS_FAILED);
    expect(draftStatusBadgeVariant("failed")).toBe("error");
    expect(submitActionLabel({ status: "failed" } as JobDraft)).toBe(COPY.RETRY);
    expect(submitActionLabel({ status: "draft" } as JobDraft)).toBe(COPY.SUBMIT);
    expect(COPY.DESKTOP_NOTIFICATIONS).toBe("Desktop notifications");
  });
});
