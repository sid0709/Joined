import type { BadgeVariant } from "@joined/design-system";

import type { CapturedJob, JobBoard } from "../capture";
import type { DraftStatus, JobDraft } from "../drafts/types";
import type { DetectedJobState } from "../hooks/detectedJob";

export const COPY = {
  DETECTED_JOB: "Detected job",
  NO_JOB_FOUND: "No job found on this page",
  LOOKING_FOR_JOB: "Looking for a job…",
  SAVE_TO_DRAFTS: "Save to drafts",
  IN_DRAFTS: "Saved to drafts",
  DRAFTS: "Drafts",
  NO_DRAFTS: "No drafts yet",
  EDIT: "Edit",
  DELETE: "Delete",
  SAVE: "Save",
  CANCEL: "Cancel",
  SUBMIT: "Submit",
  SUBMIT_ALL: "Submit all",
  RETRY: "Retry",
  SIGN_IN_TO_SUBMIT: "Sign in to submit drafts.",
  FIELD_TITLE: "Title",
  FIELD_COMPANY: "Company",
  FIELD_LOCATION: "Location",
  FIELD_APPLY_URL: "Apply URL",
  FIELD_DESCRIPTION: "Description",
  STATUS_DRAFT: "Draft",
  STATUS_SUBMITTING: "Submitting",
  STATUS_SUBMITTED: "Submitted",
  STATUS_FAILED: "Failed",
} as const;

export const DESCRIPTION_PREVIEW_CHARS = 280;
export const META_SEPARATOR = " · ";

export function jobBoardLabel(board: JobBoard): string {
  switch (board) {
    case "greenhouse":
      return "Greenhouse";
    case "lever":
      return "Lever";
    case "ashby":
      return "Ashby";
    case "workday":
      return "Workday";
    case "linkedin":
      return "LinkedIn";
    case "unknown":
      return "Job page";
    default: {
      const _exhaustive: never = board;
      return _exhaustive;
    }
  }
}

export function jobMetaLine(job: Pick<CapturedJob, "company" | "location">): string {
  return [job.company, job.location].filter(Boolean).join(META_SEPARATOR);
}

export function previewText(value: string, maxLength = DESCRIPTION_PREVIEW_CHARS): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

export function detectedJobHeading(state: DetectedJobState): string {
  switch (state.status) {
    case "loading":
      return COPY.LOOKING_FOR_JOB;
    case "empty":
      return COPY.NO_JOB_FOUND;
    case "found":
      return COPY.DETECTED_JOB;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function draftStatusLabel(status: DraftStatus): string {
  switch (status) {
    case "draft":
      return COPY.STATUS_DRAFT;
    case "submitting":
      return COPY.STATUS_SUBMITTING;
    case "submitted":
      return COPY.STATUS_SUBMITTED;
    case "failed":
      return COPY.STATUS_FAILED;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function draftStatusBadgeVariant(status: DraftStatus): BadgeVariant {
  switch (status) {
    case "draft":
      return "neutral";
    case "submitting":
      return "warning";
    case "submitted":
      return "success";
    case "failed":
      return "error";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function submitActionLabel(draft: JobDraft): string {
  return draft.status === "failed" ? COPY.RETRY : COPY.SUBMIT;
}

export function detectedJobSaveLabel(alreadyQueued: boolean): string {
  return alreadyQueued ? COPY.IN_DRAFTS : COPY.SAVE_TO_DRAFTS;
}
