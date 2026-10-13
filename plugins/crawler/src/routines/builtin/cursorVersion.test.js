import { describe, expect, test } from "bun:test";

import { compareSemver, isUsableCursorVersion } from "./cursorVersion.js";

describe("cursorVersion", () => {
  test("compares dotted versions and rejects junk", () => {
    expect(compareSemver("2.4.1", "2.4.0")).toBeGreaterThan(0);
    expect(compareSemver("2.4.0", "2.4.1")).toBeLessThan(0);
    expect(compareSemver("2.4.1", "2.4.1")).toBe(0);
    expect(compareSemver("nope", "2.4.0")).toBeNull();
  });

  test("ignores cursors written before 2.5.8", () => {
    expect(isUsableCursorVersion("2.4.0")).toBe(false);
    expect(isUsableCursorVersion("2.4.1")).toBe(false);
    expect(isUsableCursorVersion("2.5.5")).toBe(false);
    expect(isUsableCursorVersion("2.5.7")).toBe(false);
    expect(isUsableCursorVersion("")).toBe(false);
    expect(isUsableCursorVersion("2.5.8")).toBe(true);
    expect(isUsableCursorVersion("2.5.9")).toBe(true);
  });
});
