import { describe, expect, it } from "bun:test";

import { segmentShares } from "./chartMath";

describe("segmentShares", () => {
  it("returns percentages that sum to 100", () => {
    expect(segmentShares([1, 1, 2])).toEqual([25, 25, 50]);
  });

  it("returns zeros, not NaN, when everything is zero", () => {
    expect(segmentShares([0, 0])).toEqual([0, 0]);
  });

  it("ignores negative values", () => {
    expect(segmentShares([-4, 4])).toEqual([0, 100]);
  });
});
