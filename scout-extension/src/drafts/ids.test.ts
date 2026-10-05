import { describe, expect, test } from "bun:test";

import { createDraftIds, newDraftId, newIdempotencyKey } from "./ids";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("draft ids", () => {
  test("newDraftId returns a UUID", () => {
    const id = newDraftId();
    expect(id).toMatch(UUID_PATTERN);
    expect(newDraftId()).not.toBe(id);
  });

  test("newIdempotencyKey returns a UUID distinct from the draft id", () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(UUID_PATTERN);
    expect(key).not.toBe(newDraftId());
  });

  test("createDraftIds pairs a fresh id with a fresh idempotency key", () => {
    const first = createDraftIds();
    const second = createDraftIds();
    expect(first.id).toMatch(UUID_PATTERN);
    expect(first.idempotencyKey).toMatch(UUID_PATTERN);
    expect(first.id).not.toBe(first.idempotencyKey);
    expect(first.id).not.toBe(second.id);
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });
});
