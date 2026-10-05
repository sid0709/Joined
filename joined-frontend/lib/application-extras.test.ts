import { describe, expect, test } from "bun:test";

import type { Application } from "./applications";
import {
  APPLICATION_EXTRAS_STORAGE_KEY,
  applyApplicationExtras,
  extrasFromPatch,
  getApplicationExtrasServerSnapshot,
  getApplicationExtrasSnapshot,
  hydrateBoardApplications,
  mergeApplicationExtras,
  migrateApplicationExtras,
  parseApplicationExtras,
  readApplicationExtras,
  subscribeApplicationExtras,
  upsertApplicationExtras,
  writeApplicationExtras,
} from "./application-extras";

class MemoryStore {
  private data: Record<string, string>;

  constructor(data: Record<string, string> = {}) {
    this.data = { ...data };
  }

  getItem(key: string) {
    return this.data[key] ?? null;
  }

  setItem(key: string, value: string) {
    this.data[key] = value;
  }
}

const updated = new Date("2026-10-05T14:30:00.000Z");

function app(patch: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    columnId: "applied",
    jobId: "job-1",
    title: "Product Designer",
    company: "Acme",
    location: "Remote",
    salary: "$140k",
    source: "direct",
    resume: "General",
    match: 82,
    updated,
    activity: [],
    ...patch,
  };
}

describe("application extras storage", () => {
  test("round-trips notes and remindAt, ignoring corrupt payloads", () => {
    const store = new MemoryStore();
    expect(readApplicationExtras(store)).toEqual({});
    writeApplicationExtras(
      { "app-1": { notes: "Call Maya", remindAt: "2026-10-12T15:00:00.000Z" } },
      store,
    );
    expect(readApplicationExtras(store)).toEqual({
      "app-1": { notes: "Call Maya", remindAt: "2026-10-12T15:00:00.000Z" },
    });
    expect(store.getItem(APPLICATION_EXTRAS_STORAGE_KEY)).toContain("Call Maya");

    const broken = new MemoryStore({ [APPLICATION_EXTRAS_STORAGE_KEY]: "not-json" });
    expect(readApplicationExtras(broken)).toEqual({});
    const list = new MemoryStore({ [APPLICATION_EXTRAS_STORAGE_KEY]: "[]" });
    expect(readApplicationExtras(list)).toEqual({});
    expect(parseApplicationExtras("not-json")).toEqual({});
    expect(parseApplicationExtras("")).toEqual({});
    expect(parseApplicationExtras('{"app-1":{"notes":"Hi"}}')).toEqual({
      "app-1": { notes: "Hi" },
    });
  });

  test("upserts a patch without dropping the other field", () => {
    const store = new MemoryStore();
    upsertApplicationExtras("app-1", { notes: "First" }, store);
    upsertApplicationExtras("app-1", { remindAt: "2026-10-12T15:00:00.000Z" }, store);
    expect(readApplicationExtras(store)["app-1"]).toEqual({
      notes: "First",
      remindAt: "2026-10-12T15:00:00.000Z",
    });
  });

  test("migrates extras from a saved: job id onto the new application id", () => {
    const store = new MemoryStore();
    upsertApplicationExtras("saved:job-9", { notes: "Apply Friday" }, store);
    migrateApplicationExtras("saved:job-9", "app-9", store);
    migrateApplicationExtras("app-9", "app-9", store);
    expect(readApplicationExtras(store)).toEqual({
      "app-9": { notes: "Apply Friday" },
    });
  });

  test("serializes a UI patch into extras", () => {
    expect(
      extrasFromPatch({ notes: "  hi", remindAt: new Date("2026-10-12T15:00:00.000Z") }),
    ).toEqual({
      notes: "  hi",
      remindAt: "2026-10-12T15:00:00.000Z",
    });
    expect(extrasFromPatch({ remindAt: null })).toEqual({ remindAt: null });
  });

  test("notifies subscribers on write and stops after unsubscribe", () => {
    const store = new MemoryStore();
    let calls = 0;
    const stop = subscribeApplicationExtras(() => {
      calls += 1;
    });
    writeApplicationExtras({ "app-1": { notes: "x" } }, store);
    expect(calls).toBe(1);
    stop();
    writeApplicationExtras({ "app-1": { notes: "y" } }, store);
    expect(calls).toBe(1);
  });

  test("reads the extras snapshot from localStorage and an empty server snapshot", () => {
    expect(getApplicationExtrasServerSnapshot()).toBe("");
    const payload = '{"app-1":{"notes":"n"}}';
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === APPLICATION_EXTRAS_STORAGE_KEY ? payload : null),
      },
    });
    try {
      expect(getApplicationExtrasSnapshot()).toBe(payload);
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  test("readApplicationExtras with the default store still returns a map", () => {
    expect(readApplicationExtras()).toEqual(expect.any(Object));
  });

  test("treats a missing or blocked localStorage as an empty snapshot", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(getApplicationExtrasSnapshot()).toBe("");
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe("mergeApplicationExtras", () => {
  test("fills notes and remindAt only when the API omitted them", () => {
    const extras = {
      "app-1": { notes: "Local note", remindAt: "2026-10-12T15:00:00.000Z" },
    };
    const filled = mergeApplicationExtras(app(), extras);
    expect(filled.notes).toBe("Local note");
    expect(filled.remindAt?.toISOString()).toBe("2026-10-12T15:00:00.000Z");

    const fromApi = mergeApplicationExtras(
      app({ notes: "API note", remindAt: new Date("2026-11-01T10:00:00.000Z") }),
      extras,
    );
    expect(fromApi.notes).toBe("API note");
    expect(fromApi.remindAt?.toISOString()).toBe("2026-11-01T10:00:00.000Z");

    const cleared = mergeApplicationExtras(app({ id: "app-2" }), {
      "app-2": { notes: "", remindAt: null },
    });
    expect(cleared.notes).toBe("");
    expect(cleared.remindAt).toBeNull();
  });

  test("applyApplicationExtras maps a board", () => {
    const store = new MemoryStore();
    upsertApplicationExtras("app-1", { notes: "Keep" }, store);
    const [row] = applyApplicationExtras([app()], readApplicationExtras(store));
    expect(row?.notes).toBe("Keep");
  });

  test("hydrateBoardApplications parses JSON dates then fills extras", () => {
    const store = new MemoryStore();
    upsertApplicationExtras("app-1", { notes: "From disk" }, store);
    const [row] = hydrateBoardApplications(
      [
        {
          ...app(),
          updated: "2026-10-05T14:30:00.000Z",
          activity: [],
        },
      ],
      store,
    );
    expect(row?.updated.toISOString()).toBe("2026-10-05T14:30:00.000Z");
    expect(row?.notes).toBe("From disk");
  });
});
