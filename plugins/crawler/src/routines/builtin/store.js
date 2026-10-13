/* global chrome */
import packageJson from "../../../package.json";

import {
  CURSOR_STORAGE_KEY,
  CURSOR_STORAGE_KEY_V1,
  HANDLED_MAX_AGE_MS,
  HANDLED_MAX_IDS,
  HANDLED_STORAGE_KEY,
} from "./constants.js";
import { isUsableCursorVersion } from "./cursorVersion.js";
import { emptyCursor } from "./lists.js";

/** Drop handled IDs older than 90 days, then keep the newest HANDLED_MAX_IDS. */
export function pruneHandledRecord(raw, now = Date.now()) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const entries = [];
  for (const [id, at] of Object.entries(source)) {
    if (!id) continue;
    const ts = Number(at);
    if (!Number.isFinite(ts)) continue;
    if (now - ts > HANDLED_MAX_AGE_MS) continue;
    entries.push([String(id), ts]);
  }
  entries.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return Object.fromEntries(entries.slice(0, HANDLED_MAX_IDS));
}

function chromeLocal() {
  return globalThis.chrome?.storage?.local ?? null;
}

function readKey(storage, key) {
  if (!storage) return Promise.resolve(undefined);
  if (typeof storage.get !== "function") return Promise.resolve(undefined);
  if (storage.get.length >= 2) {
    return new Promise((resolve, reject) => {
      storage.get(key, (items) => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve(items?.[key]);
      });
    });
  }
  return Promise.resolve(storage.get(key)).then((items) =>
    items && typeof items === "object" && key in items ? items[key] : items,
  );
}

function writeKey(storage, key, value) {
  if (!storage) return Promise.resolve();
  if (typeof storage.set !== "function") return Promise.resolve();
  if (storage.set.length >= 2) {
    return new Promise((resolve, reject) => {
      storage.set({ [key]: value }, () => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
  }
  return Promise.resolve(storage.set({ [key]: value }));
}

export function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    get(key) {
      if (Array.isArray(key)) {
        return Object.fromEntries(key.map((name) => [name, data[name]]));
      }
      if (key && typeof key === "object") {
        return Object.fromEntries(Object.keys(key).map((name) => [name, data[name]]));
      }
      return { [key]: data[key] };
    },
    set(items) {
      Object.assign(data, items);
    },
    snapshot: () => ({ ...data }),
  };
}

function normalizeCursor(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!isUsableCursorVersion(raw.writtenBy)) return null;
  const lists = Array.isArray(raw.lists) ? raw.lists.filter(Boolean) : [];
  const listIndex = Number.isInteger(raw.listIndex) && raw.listIndex >= 0 ? raw.listIndex : 0;
  const page = Number.isInteger(raw.page) && raw.page >= 1 ? raw.page : 1;
  const pageProcessed =
    Number.isInteger(raw.pageProcessed) && raw.pageProcessed >= 0 ? raw.pageProcessed : 0;
  return {
    listIndex,
    page,
    lastJobId: raw.lastJobId ? String(raw.lastJobId) : "",
    lastPageIds: raw.lastPageIds ? String(raw.lastPageIds) : "",
    pageProcessed,
    lists,
    startUrl: raw.startUrl ? String(raw.startUrl) : lists[0] || "",
  };
}

export function createBuiltinStore(storage = chromeLocal()) {
  return {
    async loadHandledIds() {
      const raw = await readKey(storage, HANDLED_STORAGE_KEY);
      const pruned = pruneHandledRecord(raw);
      const rawCount =
        raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw).length : 0;
      if (rawCount !== Object.keys(pruned).length) {
        await writeKey(storage, HANDLED_STORAGE_KEY, pruned);
      }
      return new Set(Object.keys(pruned));
    },
    async markHandled(id, handledIds, at = Date.now()) {
      if (!id) return handledIds ?? new Set();
      const raw = await readKey(storage, HANDLED_STORAGE_KEY);
      const record = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
      record[String(id)] = at;
      const pruned = pruneHandledRecord(record, at);
      await writeKey(storage, HANDLED_STORAGE_KEY, pruned);
      return new Set(Object.keys(pruned));
    },
    async loadCursor() {
      const current = normalizeCursor(await readKey(storage, CURSOR_STORAGE_KEY));
      if (current) return current;
      const legacy = await readKey(storage, CURSOR_STORAGE_KEY_V1);
      if (legacy != null) await writeKey(storage, CURSOR_STORAGE_KEY_V1, null);
      return null;
    },
    async saveCursor(cursor) {
      if (!cursor) return writeKey(storage, CURSOR_STORAGE_KEY, null);
      return writeKey(storage, CURSOR_STORAGE_KEY, {
        listIndex: cursor.listIndex,
        page: cursor.page,
        lastJobId: cursor.lastJobId || "",
        lastPageIds: cursor.lastPageIds || "",
        pageProcessed: cursor.pageProcessed ?? 0,
        lists: cursor.lists ?? [],
        startUrl: cursor.startUrl || cursor.lists?.[0] || "",
        writtenBy: packageJson.version,
      });
    },
    async clearCursor() {
      await writeKey(storage, CURSOR_STORAGE_KEY_V1, null);
      return writeKey(storage, CURSOR_STORAGE_KEY, null);
    },
    /** Start from page 1: drop V1 and keep the stored filtered list URL. */
    async resetToPage1() {
      const current = await this.loadCursor();
      const startUrl = current?.startUrl || current?.lists?.[0] || "";
      const lists = startUrl ? [startUrl] : [];
      await writeKey(storage, CURSOR_STORAGE_KEY_V1, null);
      return this.saveCursor(emptyCursor(lists, startUrl));
    },
    async clearHandled() {
      return writeKey(storage, HANDLED_STORAGE_KEY, {});
    },
  };
}
