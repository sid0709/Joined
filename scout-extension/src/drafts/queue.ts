import { parseCapturedJob, type CapturedJob } from "../capture";

import type { DraftIds, JobDraft } from "./types";
import { isDraftStatus } from "./types";

export function sameFields(left: CapturedJob, right: CapturedJob): boolean {
  return (
    left.board === right.board &&
    left.title === right.title &&
    left.company === right.company &&
    left.location === right.location &&
    left.applyUrl === right.applyUrl &&
    left.description === right.description
  );
}

export function createDraft(fields: CapturedJob, now: string, ids: DraftIds): JobDraft {
  return {
    id: ids.id,
    idempotencyKey: ids.idempotencyKey,
    status: "draft",
    fields,
    createdAt: now,
    updatedAt: now,
  };
}

export function findOpenDraftByApplyUrl(
  drafts: readonly JobDraft[],
  applyUrl: string,
): JobDraft | undefined {
  return drafts.find((draft) => draft.fields.applyUrl === applyUrl && draft.status !== "submitted");
}

export function isJobQueued(drafts: readonly JobDraft[], job: CapturedJob): boolean {
  return findOpenDraftByApplyUrl(drafts, job.applyUrl) !== undefined;
}

export function enqueueDraft(
  drafts: readonly JobDraft[],
  fields: CapturedJob,
  now: string,
  ids: DraftIds,
): { drafts: JobDraft[]; draft: JobDraft; added: boolean } {
  const existing = findOpenDraftByApplyUrl(drafts, fields.applyUrl);
  if (existing) {
    return { drafts: [...drafts], draft: existing, added: false };
  }
  const draft = createDraft(fields, now, ids);
  return { drafts: [...drafts, draft], draft, added: true };
}

export function replaceDraft(drafts: readonly JobDraft[], next: JobDraft): JobDraft[] {
  return drafts.map((draft) => (draft.id === next.id ? next : draft));
}

export function canDelete(draft: JobDraft): boolean {
  return draft.status !== "submitting";
}

export function removeDraft(drafts: readonly JobDraft[], id: string): JobDraft[] {
  const current = drafts.find((draft) => draft.id === id);
  if (current && !canDelete(current)) {
    return [...drafts];
  }
  return drafts.filter((draft) => draft.id !== id);
}

export function parseDraft(value: unknown): JobDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    return null;
  }
  if (typeof record.idempotencyKey !== "string" || record.idempotencyKey.length === 0) {
    return null;
  }
  if (!isDraftStatus(record.status)) {
    return null;
  }
  const fields = parseCapturedJob(record.fields);
  if (!fields) {
    return null;
  }
  if (typeof record.createdAt !== "string" || record.createdAt.length === 0) {
    return null;
  }
  if (typeof record.updatedAt !== "string" || record.updatedAt.length === 0) {
    return null;
  }
  const draft: JobDraft = {
    id: record.id,
    idempotencyKey: record.idempotencyKey,
    status: record.status,
    fields,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  if (typeof record.error === "string" && record.error.length > 0) {
    draft.error = record.error;
  }
  if (typeof record.submissionId === "string" && record.submissionId.length > 0) {
    draft.submissionId = record.submissionId;
  }
  return draft;
}

export function parseDrafts(value: unknown): JobDraft[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const drafts: JobDraft[] = [];
  for (const item of value) {
    const draft = parseDraft(item);
    if (draft) {
      drafts.push(draft);
    }
  }
  return drafts;
}
