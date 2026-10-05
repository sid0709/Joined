import type { CapturedJob } from "../capture";

import { sameFields } from "./queue";
import type { JobDraft } from "./types";

export const SUBMIT_INTERRUPTED_MESSAGE = "Submit was interrupted. Retry to send again.";

export function canSubmit(draft: JobDraft): boolean {
  return draft.status === "draft" || draft.status === "failed";
}

export function canEdit(draft: JobDraft): boolean {
  return draft.status === "draft" || draft.status === "failed";
}

export function submittableDrafts(drafts: readonly JobDraft[]): JobDraft[] {
  return drafts.filter(canSubmit);
}

export function waitingDrafts(drafts: readonly JobDraft[]): JobDraft[] {
  return drafts.filter((draft) => draft.status !== "submitted");
}

export function waitingDraftCount(drafts: readonly JobDraft[]): number {
  return waitingDrafts(drafts).length;
}

export function beginSubmit(draft: JobDraft, now: string): JobDraft | null {
  if (!canSubmit(draft)) {
    return null;
  }
  return {
    ...draft,
    status: "submitting",
    error: undefined,
    updatedAt: now,
  };
}

export function completeSubmit(draft: JobDraft, submissionId: string, now: string): JobDraft {
  return {
    ...draft,
    status: "submitted",
    submissionId,
    error: undefined,
    updatedAt: now,
  };
}

export function failSubmit(draft: JobDraft, error: string, now: string): JobDraft {
  return {
    ...draft,
    status: "failed",
    error,
    updatedAt: now,
  };
}

export function recoverInterrupted(draft: JobDraft, now: string): JobDraft {
  if (draft.status !== "submitting") {
    return draft;
  }
  return failSubmit(draft, SUBMIT_INTERRUPTED_MESSAGE, now);
}

export function recoverQueue(drafts: readonly JobDraft[], now: string): JobDraft[] {
  return drafts.map((draft) => recoverInterrupted(draft, now));
}

export function editDraft(
  draft: JobDraft,
  fields: CapturedJob,
  now: string,
  nextIdempotencyKey: string,
): JobDraft | null {
  if (!canEdit(draft)) {
    return null;
  }
  const fieldsChanged = !sameFields(draft.fields, fields);
  return {
    ...draft,
    fields,
    status: "draft",
    error: undefined,
    idempotencyKey: fieldsChanged ? nextIdempotencyKey : draft.idempotencyKey,
    updatedAt: now,
  };
}
