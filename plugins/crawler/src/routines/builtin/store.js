/* global chrome */
import { CURSOR_STORAGE_KEY, HANDLED_STORAGE_KEY } from "./constants.js";

function chromeLocal() {
  return globalThis.chrome?.storage?.local ?? null;
}

function readKey(storage, key) {
  if (!storage) return Promise.resolve(undefined);
  if (typeof storage.get !== "function") return Promise.resolve(undefined);
  if (storage.get.length >= 2) {
    return new Promise((resolve, reject) => {
      storage.get(key, (items) => {
        const error = chrome?.runtime?.lastError;
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
        const error = chrome?.runtime?.lastError;
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

export function createBuiltinStore(storage = chromeLocal()) {
  return {
    async loadHandledIds() {
      const raw = await readKey(storage, HANDLED_STORAGE_KEY);
      const ids = raw && typeof raw === "object" ? Object.keys(raw) : [];
      return new Set(ids.map(String));
    },
    async markHandled(id, handledIds, at = Date.now()) {
      if (!id) return handledIds;
      const next = new Set(handledIds);
      next.add(String(id));
      const record = Object.fromEntries([...next].map((key) => [key, at]));
      await writeKey(storage, HANDLED_STORAGE_KEY, record);
      return next;
    },
    async loadCursor() {
      const raw = await readKey(storage, CURSOR_STORAGE_KEY);
      if (!raw || typeof raw !== "object") return null;
      const lists = Array.isArray(raw.lists) ? raw.lists.filter(Boolean) : [];
      const listIndex = Number.isInteger(raw.listIndex) && raw.listIndex >= 0 ? raw.listIndex : 0;
      const page = Number.isInteger(raw.page) && raw.page >= 1 ? raw.page : 1;
      return {
        listIndex,
        page,
        lastJobId: raw.lastJobId ? String(raw.lastJobId) : "",
        lists,
      };
    },
    async saveCursor(cursor) {
      if (!cursor) return writeKey(storage, CURSOR_STORAGE_KEY, null);
      return writeKey(storage, CURSOR_STORAGE_KEY, {
        listIndex: cursor.listIndex,
        page: cursor.page,
        lastJobId: cursor.lastJobId || "",
        lists: cursor.lists ?? [],
      });
    },
    async clearCursor() {
      return writeKey(storage, CURSOR_STORAGE_KEY, null);
    },
  };
}
