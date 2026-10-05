import { describe, expect, test } from "bun:test";

import {
  CAPTURE_TIMEOUT_MESSAGE,
  isCaptureJobRequest,
  isCaptureTabRequest,
  isTabNavigationMessage,
  RUNTIME_MESSAGE,
  withTimeout,
} from "./runtime";

describe("runtime messages", () => {
  test("recognizes capture and navigation messages", () => {
    expect(isCaptureTabRequest({ type: RUNTIME_MESSAGE.CAPTURE_TAB })).toBe(true);
    expect(isCaptureJobRequest({ type: RUNTIME_MESSAGE.CAPTURE_JOB })).toBe(true);
    expect(isTabNavigationMessage({ type: RUNTIME_MESSAGE.TAB_UPDATED })).toBe(true);
    expect(isTabNavigationMessage({ type: RUNTIME_MESSAGE.TAB_ACTIVATED })).toBe(true);
    expect(isCaptureTabRequest({ type: RUNTIME_MESSAGE.TAB_CLOSED })).toBe(false);
    expect(isCaptureJobRequest(null)).toBe(false);
    expect(isTabNavigationMessage({ type: 1 })).toBe(false);
  });

  test("withTimeout resolves and rejects", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
    await expect(withTimeout(new Promise(() => undefined), 1)).rejects.toThrow(
      CAPTURE_TIMEOUT_MESSAGE,
    );
    await expect(withTimeout(Promise.reject(new Error("nope")), 50)).rejects.toThrow("nope");
  });
});
