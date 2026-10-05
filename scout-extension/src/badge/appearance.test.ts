import { describe, expect, test } from "bun:test";

import type { CapturedJob } from "../capture";
import type { JobDraft } from "../drafts";

import {
  BADGE_COLOR_DRAFTS,
  BADGE_COLOR_ERROR,
  BADGE_COLOR_SIGNED_OUT,
  BADGE_OVERFLOW_TEXT,
  BADGE_TEXT_EMPTY,
  BADGE_TEXT_ERROR,
  BADGE_TEXT_SIGNED_OUT,
  formatWaitingDraftBadgeText,
  toolbarBadgeAppearance,
} from "./appearance";

const NOW = "2026-10-05T12:00:00.000Z";

const job: CapturedJob = {
  board: "greenhouse",
  title: "Staff Engineer",
  company: "Acme Labs",
  location: "Remote",
  applyUrl: "https://boards.greenhouse.io/acme/jobs/123",
  description: "Build the platform for scouts and hiring teams.",
};

function draft(overrides: Partial<JobDraft> = {}): JobDraft {
  return {
    id: "draft-1",
    idempotencyKey: "key-1",
    status: "draft",
    fields: job,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("toolbar badge appearance", () => {
  test("signed-out uses a distinct mark regardless of waiting drafts", () => {
    const appearance = toolbarBadgeAppearance("signed-out", [draft()]);
    expect(appearance).toMatchObject({
      text: BADGE_TEXT_SIGNED_OUT,
      backgroundColor: BADGE_COLOR_SIGNED_OUT,
    });
  });

  test("error uses a distinct mark regardless of waiting drafts", () => {
    const appearance = toolbarBadgeAppearance("error", [draft(), draft({ id: "draft-2" })]);
    expect(appearance).toMatchObject({
      text: BADGE_TEXT_ERROR,
      backgroundColor: BADGE_COLOR_ERROR,
    });
  });

  test("loading clears the badge", () => {
    expect(toolbarBadgeAppearance("loading", [draft()]).text).toBe(BADGE_TEXT_EMPTY);
  });

  test("signed-in shows the unsubmitted draft count and hides submitted rows", () => {
    const drafts = [
      draft(),
      draft({ id: "draft-2", status: "failed" }),
      draft({ id: "draft-3", status: "submitting" }),
      draft({ id: "draft-4", status: "submitted", submissionId: "sub-1" }),
    ];
    const appearance = toolbarBadgeAppearance("signed-in", drafts);
    expect(appearance).toMatchObject({
      text: "3",
      backgroundColor: BADGE_COLOR_DRAFTS,
    });
  });

  test("signed-in with no waiting drafts clears the badge", () => {
    expect(
      toolbarBadgeAppearance("signed-in", [draft({ status: "submitted", submissionId: "sub-1" })])
        .text,
    ).toBe(BADGE_TEXT_EMPTY);
  });

  test("counts above the badge cap collapse to overflow text", () => {
    expect(formatWaitingDraftBadgeText(0)).toBe(BADGE_TEXT_EMPTY);
    expect(formatWaitingDraftBadgeText(12)).toBe("12");
    expect(formatWaitingDraftBadgeText(99)).toBe("99");
    expect(formatWaitingDraftBadgeText(100)).toBe(BADGE_OVERFLOW_TEXT);
  });
});
