import { describe, expect, it } from "bun:test";

import { dollarsToCents, formatCents } from "./money";

describe("money", () => {
  it("formats whole dollars without cents", () => {
    expect(formatCents(2500)).toBe("$25");
  });

  it("formats fractional dollars", () => {
    expect(formatCents(150)).toBe("$1.50");
  });

  it("converts dollars to integer cents", () => {
    expect(dollarsToCents(7.5)).toBe(750);
  });
});
