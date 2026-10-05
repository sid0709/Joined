import type { KeyValueStore } from "../drafts";

import type { StatusPollState } from "./types";

export const STATUS_POLL_STORAGE_KEY = "scout.statusPoll";

export const EMPTY_STATUS_POLL_STATE: StatusPollState = {
  since: "",
  seenKeys: [],
  bootstrapped: false,
};

export function parseStatusPollState(value: unknown): StatusPollState {
  if (typeof value !== "object" || value === null) {
    return { ...EMPTY_STATUS_POLL_STATE };
  }
  const record = value as Record<string, unknown>;
  const seenKeys = Array.isArray(record.seenKeys)
    ? record.seenKeys.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  return {
    since: typeof record.since === "string" ? record.since : "",
    seenKeys,
    bootstrapped: record.bootstrapped === true,
  };
}

export async function loadStatusPollState(store: KeyValueStore): Promise<StatusPollState> {
  return parseStatusPollState(await store.get(STATUS_POLL_STORAGE_KEY));
}

export async function saveStatusPollState(
  store: KeyValueStore,
  state: StatusPollState,
): Promise<void> {
  await store.set(STATUS_POLL_STORAGE_KEY, state);
}
