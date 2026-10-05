export const SIGN_IN_RECHECK_DELAY_MS = 1000;
export const SIGN_IN_TAB_WATCH_INTERVAL_MS = 500;
export const SIGN_IN_TAB_WATCH_TIMEOUT_MS = 300_000;

export type SignInTabEventType = "tab-closed" | "tab-updated" | "popup-closed";

export interface SignInTabRefreshDecision {
  refresh: boolean;
  nextTabId: number | null;
}

export interface ParsedTabAuthMessage {
  type: "tab-closed" | "tab-updated";
  tabId: number;
}

export function parseTabAuthMessage(message: unknown): ParsedTabAuthMessage | null {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return null;
  }

  const type = message.type;
  if (type !== "tab-closed" && type !== "tab-updated") {
    return null;
  }
  if (!("tabId" in message) || typeof message.tabId !== "number") {
    return null;
  }

  return { type, tabId: message.tabId };
}

export function resolveSignInTabRefresh(input: {
  trackedTabId: number | null;
  eventType: SignInTabEventType;
  eventTabId?: number | null;
}): SignInTabRefreshDecision {
  const matches =
    input.trackedTabId !== null &&
    input.eventTabId !== null &&
    input.eventTabId !== undefined &&
    input.trackedTabId === input.eventTabId;

  switch (input.eventType) {
    case "popup-closed":
      return { refresh: true, nextTabId: null };
    case "tab-closed":
      if (!matches) {
        return { refresh: false, nextTabId: input.trackedTabId };
      }
      return { refresh: true, nextTabId: null };
    case "tab-updated":
      if (!matches) {
        return { refresh: false, nextTabId: input.trackedTabId };
      }
      return { refresh: true, nextTabId: input.trackedTabId };
    default: {
      const _exhaustive: never = input.eventType;
      throw new Error(`unexpected sign-in tab event: ${String(_exhaustive)}`);
    }
  }
}

export function applySignInTabClose(trackedTabId: number | null): SignInTabRefreshDecision {
  return resolveSignInTabRefresh({
    trackedTabId,
    eventType: "popup-closed",
  });
}

export function scheduleAuthRefresh(
  refresh: (showLoading: boolean) => void | Promise<void>,
  delayMs = SIGN_IN_RECHECK_DELAY_MS,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    void refresh(false);
  }, delayMs);
}
