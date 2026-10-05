import {
  clipNotes,
  hydrateApplication,
  parseOptionalJSONDate,
  type Application,
  type ApplicationPayload,
} from "@/lib/applications";

export const APPLICATION_EXTRAS_STORAGE_PREFIX = "joined.application-extras";

export type ApplicationExtras = {
  notes?: string;
  remindAt?: string | null;
};

export type ExtrasMap = Record<string, ApplicationExtras>;

type KeyValueStore = Pick<Storage, "getItem" | "setItem"> &
  Partial<Pick<Storage, "removeItem" | "key" | "length">>;

const extrasListeners = new Set<() => void>();

function browserStore(): KeyValueStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function applicationExtrasStorageKey(userId: string) {
  const id = userId.trim();
  if (!id) return "";
  return `${APPLICATION_EXTRAS_STORAGE_PREFIX}:${id}`;
}

function notifyExtrasListeners() {
  extrasListeners.forEach((listener) => listener());
}

function dropLegacyExtrasKey(store: KeyValueStore) {
  store.removeItem?.(APPLICATION_EXTRAS_STORAGE_PREFIX);
}

export function subscribeApplicationExtras(onStoreChange: () => void) {
  extrasListeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStoreChange);
  }
  return () => {
    extrasListeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStoreChange);
    }
  };
}

export function getApplicationExtrasSnapshot(userId: string) {
  const key = applicationExtrasStorageKey(userId);
  if (!key) return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function getApplicationExtrasServerSnapshot() {
  return "";
}

export function parseApplicationExtras(raw: string | null | undefined): ExtrasMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const extras: ExtrasMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id || !value || typeof value !== "object" || Array.isArray(value)) continue;
      extras[id] = normalizeExtras(value as ApplicationExtras);
    }
    return extras;
  } catch {
    return {};
  }
}

export function readApplicationExtras(
  userId: string,
  store: KeyValueStore | null = browserStore(),
): ExtrasMap {
  const key = applicationExtrasStorageKey(userId);
  if (!store || !key) return {};
  return parseApplicationExtras(store.getItem(key));
}

export function writeApplicationExtras(
  userId: string,
  extras: ExtrasMap,
  store: KeyValueStore | null = browserStore(),
) {
  const key = applicationExtrasStorageKey(userId);
  if (!store || !key) return;
  dropLegacyExtrasKey(store);
  store.setItem(key, JSON.stringify(extras));
  notifyExtrasListeners();
}

export function extrasFromPatch(patch: {
  notes?: string;
  remindAt?: Date | null;
}): ApplicationExtras {
  const extras: ApplicationExtras = {};
  if (patch.notes !== undefined) extras.notes = clipNotes(patch.notes);
  if (patch.remindAt !== undefined) {
    extras.remindAt = patch.remindAt ? patch.remindAt.toISOString() : null;
  }
  return extras;
}

export function upsertApplicationExtras(
  userId: string,
  id: string,
  patch: ApplicationExtras,
  store: KeyValueStore | null = browserStore(),
) {
  const extras = readApplicationExtras(userId, store);
  extras[id] = { ...extras[id], ...patch };
  writeApplicationExtras(userId, extras, store);
  return extras;
}

export function migrateApplicationExtras(
  userId: string,
  fromId: string,
  toId: string,
  store: KeyValueStore | null = browserStore(),
) {
  if (!fromId || !toId || fromId === toId) return;
  const extras = readApplicationExtras(userId, store);
  const current = extras[fromId];
  if (!current) return;
  extras[toId] = { ...current, ...extras[toId] };
  delete extras[fromId];
  writeApplicationExtras(userId, extras, store);
}

export function pruneApplicationExtras(
  userId: string,
  id: string,
  store: KeyValueStore | null = browserStore(),
) {
  if (!id) return;
  const extras = readApplicationExtras(userId, store);
  if (!(id in extras)) return;
  delete extras[id];
  writeApplicationExtras(userId, extras, store);
}

export function clearApplicationExtras(store: KeyValueStore | null = browserStore()) {
  if (!store?.removeItem) return;
  dropLegacyExtrasKey(store);
  const length = store.length ?? 0;
  if (typeof store.key !== "function") {
    notifyExtrasListeners();
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < length; i += 1) {
    const key = store.key(i);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    if (key.startsWith(`${APPLICATION_EXTRAS_STORAGE_PREFIX}:`)) store.removeItem(key);
  }
  notifyExtrasListeners();
}

export function mergeApplicationExtras(application: Application, extras: ExtrasMap): Application {
  const local = extras[application.id];
  if (!local) return application;
  const notes = application.notes !== undefined ? application.notes : local.notes;
  const remindAt =
    application.remindAt !== undefined
      ? application.remindAt
      : parseOptionalJSONDate(local.remindAt);
  return {
    ...application,
    notes,
    remindAt: remindAt === undefined ? application.remindAt : remindAt,
  };
}

export function applyApplicationExtras(items: Application[], extras: ExtrasMap) {
  return items.map((item) => mergeApplicationExtras(item, extras));
}

export function hydrateBoardApplications(
  items: Array<Application | ApplicationPayload>,
  userId: string,
  store: KeyValueStore | null = browserStore(),
) {
  return applyApplicationExtras(
    items.map(hydrateApplication),
    readApplicationExtras(userId, store),
  );
}

function normalizeExtras(value: ApplicationExtras): ApplicationExtras {
  const extras: ApplicationExtras = {};
  if (typeof value.notes === "string") extras.notes = clipNotes(value.notes);
  if (value.remindAt === null) extras.remindAt = null;
  else if (typeof value.remindAt === "string") extras.remindAt = value.remindAt;
  return extras;
}
