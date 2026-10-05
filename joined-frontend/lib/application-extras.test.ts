import { describe, expect, test } from "bun:test";

import type { Application } from "./applications";
import {
  APPLICATION_EXTRAS_STORAGE_PREFIX,
  applicationExtrasStorageKey,
  applyApplicationExtras,
  clearApplicationExtras,
  extrasFromPatch,
  getApplicationExtrasServerSnapshot,
  getApplicationExtrasSnapshot,
  hydrateBoardApplications,
  mergeApplicationExtras,
  migrateApplicationExtras,
  parseApplicationExtras,
  pruneApplicationExtras,
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

  removeItem(key: string) {
    delete this.data[key];
  }

  key(index: number) {
    return Object.keys(this.data)[index] ?? null;
  }

  get length() {
    return Object.keys(this.data).length;
  }
}

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const USER_KEY = applicationExtrasStorageKey(USER_ID);
const OTHER_KEY = applicationExtrasStorageKey(OTHER_USER_ID);
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
  test("scopes the storage key by userId and never uses the unscoped legacy key", () => {
    expect(USER_KEY).toBe("joined.application-extras:user-1");
    expect(applicationExtrasStorageKey("")).toBe("");
    expect(applicationExtrasStorageKey("  ")).toBe("");

    const store = new MemoryStore({
      [APPLICATION_EXTRAS_STORAGE_PREFIX]: '{"app-1":{"notes":"leak"}}',
    });
    expect(readApplicationExtras(USER_ID, store)).toEqual({});
    expect(readApplicationExtras("", store)).toEqual({});
    writeApplicationExtras("", { "app-1": { notes: "nope" } }, store);
    expect(store.getItem(APPLICATION_EXTRAS_STORAGE_PREFIX)).toContain("leak");
  });

  test("round-trips notes and remindAt, ignoring corrupt payloads", () => {
    const store = new MemoryStore();
    expect(readApplicationExtras(USER_ID, store)).toEqual({});
    writeApplicationExtras(
      USER_ID,
      { "app-1": { notes: "Call Maya", remindAt: "2026-10-12T15:00:00.000Z" } },
      store,
    );
    expect(readApplicationExtras(USER_ID, store)).toEqual({
      "app-1": { notes: "Call Maya", remindAt: "2026-10-12T15:00:00.000Z" },
    });
    expect(store.getItem(USER_KEY)).toContain("Call Maya");
    expect(store.getItem(APPLICATION_EXTRAS_STORAGE_PREFIX)).toBeNull();

    const broken = new MemoryStore({ [USER_KEY]: "not-json" });
    expect(readApplicationExtras(USER_ID, broken)).toEqual({});
    const list = new MemoryStore({ [USER_KEY]: "[]" });
    expect(readApplicationExtras(USER_ID, list)).toEqual({});
    expect(parseApplicationExtras("not-json")).toEqual({});
    expect(parseApplicationExtras("")).toEqual({});
    expect(parseApplicationExtras('{"app-1":{"notes":"Hi"}}')).toEqual({
      "app-1": { notes: "Hi" },
    });
  });

  test("keeps extras for one user isolated from another", () => {
    const store = new MemoryStore();
    upsertApplicationExtras(USER_ID, "saved:job-1", { notes: "Maya's note" }, store);
    upsertApplicationExtras(OTHER_USER_ID, "saved:job-1", { notes: "Other note" }, store);
    expect(readApplicationExtras(USER_ID, store)["saved:job-1"]?.notes).toBe("Maya's note");
    expect(readApplicationExtras(OTHER_USER_ID, store)["saved:job-1"]?.notes).toBe("Other note");
    expect(store.getItem(USER_KEY)).not.toContain("Other note");
    expect(store.getItem(OTHER_KEY)).not.toContain("Maya's note");
  });

  test("upserts a patch without dropping the other field", () => {
    const store = new MemoryStore();
    upsertApplicationExtras(USER_ID, "app-1", { notes: "First" }, store);
    upsertApplicationExtras(USER_ID, "app-1", { remindAt: "2026-10-12T15:00:00.000Z" }, store);
    expect(readApplicationExtras(USER_ID, store)["app-1"]).toEqual({
      notes: "First",
      remindAt: "2026-10-12T15:00:00.000Z",
    });
  });

  test("migrates extras from a saved: job id onto the new application id", () => {
    const store = new MemoryStore();
    upsertApplicationExtras(USER_ID, "saved:job-9", { notes: "Apply Friday" }, store);
    migrateApplicationExtras(USER_ID, "saved:job-9", "app-9", store);
    migrateApplicationExtras(USER_ID, "app-9", "app-9", store);
    expect(readApplicationExtras(USER_ID, store)).toEqual({
      "app-9": { notes: "Apply Friday" },
    });
  });

  test("prunes extras for a removed application id", () => {
    const store = new MemoryStore();
    upsertApplicationExtras(USER_ID, "app-1", { notes: "Keep" }, store);
    upsertApplicationExtras(USER_ID, "app-2", { notes: "Drop" }, store);
    pruneApplicationExtras(USER_ID, "app-2", store);
    pruneApplicationExtras(USER_ID, "", store);
    pruneApplicationExtras(USER_ID, "missing", store);
    expect(readApplicationExtras(USER_ID, store)).toEqual({
      "app-1": { notes: "Keep" },
    });
  });

  test("clears the legacy key and every user-scoped extras key on logout", () => {
    const store = new MemoryStore({
      [APPLICATION_EXTRAS_STORAGE_PREFIX]: '{"app-1":{"notes":"legacy"}}',
      theme: "dark",
    });
    upsertApplicationExtras(USER_ID, "app-1", { notes: "mine" }, store);
    upsertApplicationExtras(OTHER_USER_ID, "app-1", { notes: "theirs" }, store);
    let calls = 0;
    const stop = subscribeApplicationExtras(() => {
      calls += 1;
    });
    clearApplicationExtras(store);
    stop();
    expect(store.getItem(APPLICATION_EXTRAS_STORAGE_PREFIX)).toBeNull();
    expect(store.getItem(USER_KEY)).toBeNull();
    expect(store.getItem(OTHER_KEY)).toBeNull();
    expect(store.getItem("theme")).toBe("dark");
    expect(calls).toBe(1);
  });

  test("clearApplicationExtras is a no-op without removeItem and still drops the legacy key when key() is missing", () => {
    clearApplicationExtras(null);
    clearApplicationExtras({ getItem: () => null, setItem: () => undefined });
    const store = {
      data: { [APPLICATION_EXTRAS_STORAGE_PREFIX]: "{}", [USER_KEY]: "{}" } as Record<
        string,
        string
      >,
      getItem(key: string) {
        return this.data[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.data[key] = value;
      },
      removeItem(key: string) {
        delete this.data[key];
      },
    };
    clearApplicationExtras(store);
    expect(store.getItem(APPLICATION_EXTRAS_STORAGE_PREFIX)).toBeNull();
    expect(store.getItem(USER_KEY)).toBe("{}");
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
    writeApplicationExtras(USER_ID, { "app-1": { notes: "x" } }, store);
    expect(calls).toBe(1);
    stop();
    writeApplicationExtras(USER_ID, { "app-1": { notes: "y" } }, store);
    expect(calls).toBe(1);
  });

  test("reads the extras snapshot from localStorage and an empty server snapshot", () => {
    expect(getApplicationExtrasServerSnapshot()).toBe("");
    expect(getApplicationExtrasSnapshot("")).toBe("");
    const payload = '{"app-1":{"notes":"n"}}';
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === USER_KEY ? payload : null),
      },
    });
    try {
      expect(getApplicationExtrasSnapshot(USER_ID)).toBe(payload);
      expect(getApplicationExtrasSnapshot(OTHER_USER_ID)).toBe("");
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  test("readApplicationExtras with the default store still returns a map", () => {
    expect(readApplicationExtras(USER_ID)).toEqual(expect.any(Object));
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
      expect(getApplicationExtrasSnapshot(USER_ID)).toBe("");
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
    upsertApplicationExtras(USER_ID, "app-1", { notes: "Keep" }, store);
    const [row] = applyApplicationExtras([app()], readApplicationExtras(USER_ID, store));
    expect(row?.notes).toBe("Keep");
  });

  test("hydrateBoardApplications parses JSON dates then fills extras", () => {
    const store = new MemoryStore();
    upsertApplicationExtras(USER_ID, "app-1", { notes: "From disk" }, store);
    const [row] = hydrateBoardApplications(
      [
        {
          ...app(),
          updated: "2026-10-05T14:30:00.000Z",
          activity: [],
        },
      ],
      USER_ID,
      store,
    );
    expect(row?.updated.toISOString()).toBe("2026-10-05T14:30:00.000Z");
    expect(row?.notes).toBe("From disk");
  });
});
