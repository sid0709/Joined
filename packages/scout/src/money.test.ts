import { describe, expect, test } from "bun:test";

import { formatMoney, formatRate, sumMoney } from "./money";

describe("formatMoney", () => {
  test("drops decimals for whole amounts", () => {
    expect(formatMoney({ amount_cents: 2500, currency: "USD" })).toBe("$25");
  });
  test("keeps cents otherwise", () => {
    expect(formatMoney({ amount_cents: 1875, currency: "USD" })).toBe("$18.75");
  });
  test("treats a missing amount as zero dollars", () => {
    expect(formatMoney(null)).toBe("$0");
  });
});

describe("sumMoney", () => {
  test("adds amounts in their currency", () => {
    expect(
      sumMoney([
        { amount_cents: 150, currency: "EUR" },
        { amount_cents: 50, currency: "EUR" },
      ]),
    ).toEqual({ amount_cents: 200, currency: "EUR" });
  });
  test("an empty list is zero in the default currency", () => {
    expect(sumMoney([])).toEqual({ amount_cents: 0, currency: "USD" });
  });
});

test("formatRate rounds a ratio to a percentage", () => {
  expect(formatRate(0.906)).toBe("91%");
});
