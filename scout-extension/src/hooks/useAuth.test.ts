import { describe, expect, mock, test } from "bun:test";
import {
  applySignInTabClose,
  parseTabAuthMessage,
  resolveSignInTabRefresh,
  scheduleAuthRefresh,
} from "../auth/signInTab";

describe("useAuth tab tracking", () => {
  test("re-checks auth when tracked sign-in tab closes", () => {
    const decision = resolveSignInTabRefresh({
      trackedTabId: 42,
      eventType: "tab-closed",
      eventTabId: 42,
    });

    expect(decision.refresh).toBe(true);
    expect(decision.nextTabId).toBeNull();
  });

  test("re-checks auth when tracked sign-in tab finishes loading", () => {
    const decision = resolveSignInTabRefresh({
      trackedTabId: 7,
      eventType: "tab-updated",
      eventTabId: 7,
    });

    expect(decision.refresh).toBe(true);
    expect(decision.nextTabId).toBe(7);
  });

  test("does not re-check auth for an unrelated tab", () => {
    const closed = resolveSignInTabRefresh({
      trackedTabId: 42,
      eventType: "tab-closed",
      eventTabId: 99,
    });
    const updated = resolveSignInTabRefresh({
      trackedTabId: 42,
      eventType: "tab-updated",
      eventTabId: 99,
    });

    expect(closed.refresh).toBe(false);
    expect(closed.nextTabId).toBe(42);
    expect(updated.refresh).toBe(false);
    expect(updated.nextTabId).toBe(42);
  });

  test("calls checkAuth on the close path even if signInTabId is already cleared", () => {
    const runtimeAfterClear = resolveSignInTabRefresh({
      trackedTabId: null,
      eventType: "tab-closed",
      eventTabId: 42,
    });
    expect(runtimeAfterClear.refresh).toBe(false);

    const closePath = applySignInTabClose(null);
    expect(closePath.refresh).toBe(true);
    expect(closePath.nextTabId).toBeNull();
  });

  test("schedules checkAuth before applying the cleared tab id", async () => {
    const refresh = mock(() => undefined);
    const decision = applySignInTabClose(42);

    expect(decision.refresh).toBe(true);
    scheduleAuthRefresh(refresh, 0);
    expect(decision.nextTabId).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refresh).toHaveBeenCalledWith(false);
  });

  test("parses tab-closed and tab-updated runtime messages", () => {
    expect(parseTabAuthMessage({ type: "tab-closed", tabId: 3 })).toEqual({
      type: "tab-closed",
      tabId: 3,
    });
    expect(parseTabAuthMessage({ type: "tab-updated", tabId: 8 })).toEqual({
      type: "tab-updated",
      tabId: 8,
    });
    expect(parseTabAuthMessage({ type: "tab-closed" })).toBeNull();
    expect(parseTabAuthMessage({ type: "other", tabId: 1 })).toBeNull();
    expect(parseTabAuthMessage(null)).toBeNull();
    expect(parseTabAuthMessage("tab-closed")).toBeNull();
  });
});
