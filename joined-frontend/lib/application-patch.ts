import type { ApplicationStage } from "@/lib/applications";

export type ApplicationPatch = {
  columnId?: ApplicationStage | string;
  closedReason?: string;
  nextStep?: string;
  /** Candidate private notes. Backend ApplicationPatch does not persist this yet. */
  notes?: string;
  /** ISO-8601 follow-up time, or null to clear. Backend ApplicationPatch does not persist this yet. */
  remindAt?: string | null;
};

export function toApplicationPatch(patch: {
  columnId?: ApplicationStage | string;
  closedReason?: string;
  nextStep?: string;
  notes?: string;
  remindAt?: Date | null;
}): ApplicationPatch {
  const body: ApplicationPatch = {};
  if (patch.columnId !== undefined) body.columnId = patch.columnId;
  if (patch.closedReason !== undefined) body.closedReason = patch.closedReason;
  if (patch.nextStep !== undefined) body.nextStep = patch.nextStep;
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.remindAt !== undefined) {
    body.remindAt = patch.remindAt ? patch.remindAt.toISOString() : null;
  }
  return body;
}
