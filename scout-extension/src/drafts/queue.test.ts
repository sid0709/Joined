import { describe, expect, test } from "bun:test";

import type { CapturedJob } from "../capture";

import {
  createDraft,
  enqueueDraft,
  isJobQueued,
  parseDraft,
  parseDrafts,
  removeDraft,
  replaceDraft,
} from "./queue";
import { toExtensionInput } from "./payload";
import {
  chromeLocalStore,
  loadDraftQueue,
  loadRecoveredDraftQueue,
  saveDraftQueue,
} from "./storage";
import type { KeyValueStore } from "./storage";
import {
  SUBMIT_INTERRUPTED_MESSAGE,
  beginSubmit,
  canSubmit,
  completeSubmit,
  editDraft,
  failSubmit,
  recoverQueue,
  submittableDrafts,
  waitingDraftCount,
  waitingDrafts,
} from "./submit";
import type { JobDraft } from "./types";

const NOW = "2026-10-05T12:00:00.000Z";
const LATER = "2026-10-05T12:01:00.000Z";

const job: CapturedJob = {
  board: "greenhouse",
  title: "Staff Engineer",
  company: "Acme Labs",
  location: "Remote",
  applyUrl: "https://boards.greenhouse.io/acme/jobs/123",
  description: "Build the platform for scouts and hiring teams.",
};

const otherJob: CapturedJob = {
  ...job,
  title: "Principal Engineer",
  applyUrl: "https://boards.greenhouse.io/acme/jobs/456",
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

function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const data: Record<string, unknown> = { ...initial };
  return {
    async get(key) {
      return data[key];
    },
    async set(key, value) {
      data[key] = value;
    },
  };
}

describe("draft queue store", () => {
  test("enqueue adds a draft with a stable local id and captured fields", () => {
    const result = enqueueDraft([], job, NOW, { id: "draft-1", idempotencyKey: "key-1" });

    expect(result.added).toBe(true);
    expect(result.draft).toEqual(createDraft(job, NOW, { id: "draft-1", idempotencyKey: "key-1" }));
    expect(result.draft.fields).toEqual(job);
    expect(result.drafts).toHaveLength(1);
  });

  test("enqueue reuses an open draft with the same apply URL", () => {
    const first = enqueueDraft([], job, NOW, { id: "draft-1", idempotencyKey: "key-1" });
    const second = enqueueDraft(first.drafts, { ...job, title: "Other title" }, LATER, {
      id: "draft-2",
      idempotencyKey: "key-2",
    });

    expect(second.added).toBe(false);
    expect(second.draft.id).toBe("draft-1");
    expect(second.drafts).toHaveLength(1);
    expect(isJobQueued(second.drafts, job)).toBe(true);
  });

  test("enqueue allows the same apply URL after the previous draft was submitted", () => {
    const submitted = draft({ status: "submitted", submissionId: "sub-1" });
    const result = enqueueDraft([submitted], job, LATER, {
      id: "draft-2",
      idempotencyKey: "key-2",
    });

    expect(result.added).toBe(true);
    expect(result.drafts).toHaveLength(2);
    expect(result.draft.id).toBe("draft-2");
  });

  test("remove deletes a draft and leaves an in-flight submit in place", () => {
    const submitting = draft({ id: "draft-2", status: "submitting" });
    expect(removeDraft([draft(), submitting], "draft-1")).toEqual([submitting]);
    expect(removeDraft([submitting], "draft-2")).toEqual([submitting]);
  });

  test("parseDrafts keeps valid rows and drops corrupt storage", () => {
    const stored = draft({ error: "quota", submissionId: "sub-1" });
    expect(parseDraft(stored)).toEqual(stored);
    expect(parseDrafts([stored, { id: "bad" }, null, "nope"])).toEqual([stored]);
    expect(parseDrafts({ drafts: [stored] })).toEqual([]);
  });

  test("drafts survive a new load from chrome.storage.local", async () => {
    const store = memoryStore();
    const queued = [draft(), draft({ id: "draft-2", idempotencyKey: "key-2", fields: otherJob })];

    await saveDraftQueue(store, queued);
    const loaded = await loadDraftQueue(store);

    expect(loaded).toEqual(queued);
  });

  test("a recovered load after restart keeps drafts and fails interrupted submits", async () => {
    const store = memoryStore();
    await saveDraftQueue(store, [
      draft(),
      draft({ id: "draft-2", status: "submitting", idempotencyKey: "key-2" }),
    ]);

    const loaded = await loadRecoveredDraftQueue(store, LATER);
    expect(loaded[0]?.status).toBe("draft");
    expect(loaded[1]).toMatchObject({
      id: "draft-2",
      status: "failed",
      error: SUBMIT_INTERRUPTED_MESSAGE,
      idempotencyKey: "key-2",
      updatedAt: LATER,
    });
    expect(await loadDraftQueue(store)).toEqual(loaded);
  });
});

describe("submit state machine", () => {
  test("waiting drafts exclude submitted rows", () => {
    const drafts = [
      draft(),
      draft({ id: "draft-2", status: "failed" }),
      draft({ id: "draft-3", status: "submitting" }),
      draft({ id: "draft-4", status: "submitted", submissionId: "sub-1" }),
    ];
    expect(waitingDraftCount(drafts)).toBe(3);
    expect(waitingDrafts(drafts).map((item) => item.id)).toEqual(["draft-1", "draft-2", "draft-3"]);
  });

  test("draft and failed can submit; submitted and submitting cannot", () => {
    expect(canSubmit(draft())).toBe(true);
    expect(canSubmit(draft({ status: "failed", error: "boom" }))).toBe(true);
    expect(canSubmit(draft({ status: "submitting" }))).toBe(false);
    expect(canSubmit(draft({ status: "submitted", submissionId: "sub-1" }))).toBe(false);
    expect(
      submittableDrafts([draft(), draft({ id: "draft-2", status: "submitted" })]),
    ).toHaveLength(1);
  });

  test("beginSubmit moves draft to submitting and keeps the idempotency key", () => {
    const started = beginSubmit(draft(), LATER);
    expect(started).toMatchObject({
      status: "submitting",
      idempotencyKey: "key-1",
      updatedAt: LATER,
    });
    expect(started?.error).toBeUndefined();
    expect(beginSubmit(draft({ status: "submitted" }), LATER)).toBeNull();
  });

  test("retry of a failed draft keeps the same Idempotency-Key", () => {
    const failed = failSubmit(draft({ status: "submitting" }), "quota exceeded", LATER);
    expect(failed).toMatchObject({
      status: "failed",
      error: "quota exceeded",
      idempotencyKey: "key-1",
    });

    const retried = beginSubmit(failed, "2026-10-05T12:02:00.000Z");
    expect(retried).toMatchObject({
      status: "submitting",
      idempotencyKey: "key-1",
    });
    expect(retried?.error).toBeUndefined();
  });

  test("completeSubmit records the server submission id", () => {
    const started = beginSubmit(draft(), LATER);
    if (!started) {
      throw new Error("expected beginSubmit");
    }
    expect(completeSubmit(started, "sub-99", "2026-10-05T12:02:00.000Z")).toMatchObject({
      status: "submitted",
      submissionId: "sub-99",
      idempotencyKey: "key-1",
    });
  });

  test("edit regenerates the idempotency key only when captured fields change", () => {
    const failed = draft({ status: "failed", error: "validation_failed" });
    const unchanged = editDraft(failed, job, LATER, "key-new");
    expect(unchanged).toMatchObject({ status: "draft", idempotencyKey: "key-1" });
    expect(unchanged?.error).toBeUndefined();

    const changed = editDraft(failed, { ...job, title: "New title" }, LATER, "key-new");
    expect(changed).toMatchObject({
      status: "draft",
      idempotencyKey: "key-new",
      fields: { title: "New title" },
    });
    expect(editDraft(draft({ status: "submitting" }), job, LATER, "key-new")).toBeNull();
  });

  test("recoverQueue marks in-flight submits as failed so they can retry with the same key", () => {
    const recovered = recoverQueue(
      [draft(), draft({ id: "draft-2", status: "submitting", idempotencyKey: "key-2" })],
      LATER,
    );
    expect(recovered[1]).toMatchObject({
      status: "failed",
      error: SUBMIT_INTERRUPTED_MESSAGE,
      idempotencyKey: "key-2",
    });
  });

  test("replaceDraft swaps one row without touching the others", () => {
    const first = draft();
    const second = draft({ id: "draft-2", idempotencyKey: "key-2", fields: otherJob });
    const next = { ...first, status: "submitted" as const, submissionId: "sub-1" };
    expect(replaceDraft([first, second], next)).toEqual([next, second]);
  });

  test("toExtensionInput maps captured fields onto the intake body", () => {
    expect(toExtensionInput(job)).toEqual({
      title: job.title,
      company: job.company,
      location: job.location,
      apply_url: job.applyUrl,
      description: job.description,
      board: job.board,
    });
  });
});

describe("chrome.storage.local adapter", () => {
  test("chromeLocalStore reads and writes the draft queue key", async () => {
    const data: Record<string, unknown> = {};
    const chromeMock = {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: data[key] }),
          set: async (items: Record<string, unknown>) => {
            Object.assign(data, items);
          },
        },
      },
    };
    (globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

    const store = chromeLocalStore();
    await saveDraftQueue(store, [draft()]);
    expect(await loadDraftQueue(store)).toEqual([draft()]);
  });
});
