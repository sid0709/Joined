import type { DraftIds } from "./types";

export function newDraftId(): string {
  return crypto.randomUUID();
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function createDraftIds(): DraftIds {
  return { id: newDraftId(), idempotencyKey: newIdempotencyKey() };
}
