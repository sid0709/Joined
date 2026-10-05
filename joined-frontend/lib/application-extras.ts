import {
  clipNotes,
  hydrateApplication,
  parseOptionalJSONDate,
  type Application,
  type ApplicationPayload,
} from "@/lib/applications";

export const APPLICATION_EXTRAS_STORAGE_KEY = "joined.application-extras";

export type ApplicationExtras = {
  notes?: string;
  remindAt?: string | null;
};

export type ExtrasMap = Record<string, ApplicationExtras>;

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

const extrasListeners = new Set<() => void>();

function browserStore(): KeyValueStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
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

export function getApplicationExtrasSnapshot() {
  try {
    return localStorage.getItem(APPLICATION_EXTRAS_STORAGE_KEY) ?? "";
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

export function readApplicationExtras(store: KeyValueStore | null = browserStore()): ExtrasMap {
  if (!store) return {};
  return parseApplicationExtras(store.getItem(APPLICATION_EXTRAS_STORAGE_KEY));
}

export function writeApplicationExtras(
  extras: ExtrasMap,
  store: KeyValueStore | null = browserStore(),
) {
  if (!store) return;
  store.setItem(APPLICATION_EXTRAS_STORAGE_KEY, JSON.stringify(extras));
  extrasListeners.forEach((listener) => listener());
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
  id: string,
  patch: ApplicationExtras,
  store: KeyValueStore | null = browserStore(),
) {
  const extras = readApplicationExtras(store);
  extras[id] = { ...extras[id], ...patch };
  writeApplicationExtras(extras, store);
  return extras;
}

export function migrateApplicationExtras(
  fromId: string,
  toId: string,
  store: KeyValueStore | null = browserStore(),
) {
  if (!fromId || !toId || fromId === toId) return;
  const extras = readApplicationExtras(store);
  const current = extras[fromId];
  if (!current) return;
  extras[toId] = { ...current, ...extras[toId] };
  delete extras[fromId];
  writeApplicationExtras(extras, store);
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

export function applyApplicationExtras(
  items: Application[],
  extras: ExtrasMap = readApplicationExtras(),
) {
  return items.map((item) => mergeApplicationExtras(item, extras));
}

export function hydrateBoardApplications(
  items: Array<Application | ApplicationPayload>,
  store: KeyValueStore | null = browserStore(),
) {
  return applyApplicationExtras(items.map(hydrateApplication), readApplicationExtras(store));
}

function normalizeExtras(value: ApplicationExtras): ApplicationExtras {
  const extras: ApplicationExtras = {};
  if (typeof value.notes === "string") extras.notes = clipNotes(value.notes);
  if (value.remindAt === null) extras.remindAt = null;
  else if (typeof value.remindAt === "string") extras.remindAt = value.remindAt;
  return extras;
}
