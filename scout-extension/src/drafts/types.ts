import type { CapturedJob } from "../capture";

export const DRAFT_STATUSES = ["draft", "submitting", "submitted", "failed"] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export interface DraftIds {
  id: string;
  idempotencyKey: string;
}

export interface JobDraft {
  id: string;
  idempotencyKey: string;
  status: DraftStatus;
  fields: CapturedJob;
  createdAt: string;
  updatedAt: string;
  error?: string;
  submissionId?: string;
}

export function isDraftStatus(value: unknown): value is DraftStatus {
  return typeof value === "string" && (DRAFT_STATUSES as readonly string[]).includes(value);
}
