import { describe, expect, test } from "bun:test";

import { compareSemver, isUsableCursorVersion } from "./cursorVersion.js";

describe("cursorVersion", () => {
  test("compares dotted versions and rejects junk", () => {
    expect(compareSemver("2.4.1", "2.4.0")).toBeGreaterThan(0);
    expect(compareSemver("2.4.0", "2.4.1")).toBeLessThan(0);
    expect(compareSemver("2.4.1", "2.4.1")).toBe(0);
    expect(compareSemver("nope", "2.4.0")).toBeNull();
  });

  test("ignores cursors written by 2.4.0 or older", () => {
    expect(isUsableCursorVersion("2.4.0")).toBe(false);
    expect(isUsableCursorVersion("2.3.9")).toBe(false);
    expect(isUsableCursorVersion("")).toBe(false);
    expect(isUsableCursorVersion("2.4.1")).toBe(true);
    expect(isUsableCursorVersion("2.4.2")).toBe(true);
    expect(isUsableCursorVersion("2.4.3")).toBe(true);
    expect(isUsableCursorVersion("2.4.4")).toBe(true);
  });
});
