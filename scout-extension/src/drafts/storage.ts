import { parseDrafts } from "./queue";
import { recoverQueue } from "./submit";
import type { JobDraft } from "./types";

export const DRAFT_QUEUE_STORAGE_KEY = "scout.draftQueue";

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function chromeLocalStore(): KeyValueStore {
  return {
    async get(key) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
  };
}

export async function loadDraftQueue(store: KeyValueStore): Promise<JobDraft[]> {
  return parseDrafts(await store.get(DRAFT_QUEUE_STORAGE_KEY));
}

export async function saveDraftQueue(store: KeyValueStore, drafts: JobDraft[]): Promise<void> {
  await store.set(DRAFT_QUEUE_STORAGE_KEY, drafts);
}

export async function loadRecoveredDraftQueue(
  store: KeyValueStore,
  now: string,
): Promise<JobDraft[]> {
  const recovered = recoverQueue(await loadDraftQueue(store), now);
  await saveDraftQueue(store, recovered);
  return recovered;
}
