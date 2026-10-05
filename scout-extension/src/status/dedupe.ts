import { isNotifiableEvent, type ScoutStatusNotification, type StatusPollState } from "./types";

export const MAX_SEEN_STATUS_KEYS = 500;

export function notificationDedupeKey(item: ScoutStatusNotification): string {
  if (!item.event) {
    return item.id;
  }
  switch (item.event) {
    case "accepted":
    case "rejected":
    case "published":
      return item.subject_id ? `${item.event}:${item.subject_id}` : item.id;
    case "earned":
      return `earned:${item.id}`;
    default: {
      const _exhaustive: never = item.event;
      return _exhaustive;
    }
  }
}

export function isNotifiableStatus(item: ScoutStatusNotification): boolean {
  return isNotifiableEvent(item.event);
}

export function alreadyNotified(
  seenKeys: ReadonlySet<string>,
  item: ScoutStatusNotification,
): boolean {
  return seenKeys.has(notificationDedupeKey(item)) || seenKeys.has(item.id);
}

export function rememberNotification(seenKeys: Set<string>, item: ScoutStatusNotification): void {
  seenKeys.add(notificationDedupeKey(item));
  seenKeys.add(item.id);
}

export function trimSeenKeys(keys: readonly string[], max = MAX_SEEN_STATUS_KEYS): string[] {
  if (keys.length <= max) {
    return [...keys];
  }
  return keys.slice(keys.length - max);
}

export function nextSinceCursor(
  current: string,
  items: readonly ScoutStatusNotification[],
): string {
  if (items.length === 0) {
    return current;
  }
  return items[items.length - 1]?.id ?? current;
}

export function planStatusNotifications(
  state: StatusPollState,
  items: readonly ScoutStatusNotification[],
): { state: StatusPollState; toNotify: ScoutStatusNotification[] } {
  const seenKeys = new Set(state.seenKeys);
  const toNotify: ScoutStatusNotification[] = [];

  for (const item of items) {
    const duplicate = alreadyNotified(seenKeys, item);
    rememberNotification(seenKeys, item);
    if (duplicate) {
      continue;
    }
    if (state.bootstrapped && isNotifiableStatus(item)) {
      toNotify.push(item);
    }
  }

  return {
    state: {
      since: nextSinceCursor(state.since, items),
      seenKeys: trimSeenKeys([...seenKeys]),
      bootstrapped: true,
    },
    toNotify,
  };
}
