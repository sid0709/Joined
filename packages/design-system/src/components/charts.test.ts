import { describe, expect, it } from "bun:test";

import { areaPath, linePath, segmentShares, sparklinePoints } from "./charts";

describe("sparklinePoints", () => {
  it("returns nothing for an empty series", () => {
    expect(sparklinePoints([], 100, 20)).toEqual([]);
  });

  it("puts the minimum on the baseline and the maximum on the top edge", () => {
    const points = sparklinePoints([1, 3], 100, 20, 0);
    expect(points[0]).toEqual({ x: 0, y: 20 });
    expect(points[1]).toEqual({ x: 100, y: 0 });
  });

  it("centres a flat series vertically instead of dividing by zero", () => {
    const points = sparklinePoints([5, 5, 5], 100, 20, 0);
    expect(points.every((p) => p.y === 10)).toBe(true);
  });

  it("centres a single point horizontally", () => {
    expect(sparklinePoints([7], 100, 20, 0)[0]?.x).toBe(50);
  });
});

describe("paths", () => {
  it("draws a line through the points", () => {
    expect(
      linePath([
        { x: 0, y: 5 },
        { x: 10, y: 1.234 },
      ]),
    ).toBe("M0 5 L10 1.23");
  });

  it("closes the area down to the padded baseline", () => {
    const d = areaPath(
      [
        { x: 2, y: 5 },
        { x: 8, y: 3 },
      ],
      20,
      2,
    );
    expect(d.endsWith("L8 18 L2 18 Z")).toBe(true);
    expect(areaPath([], 20)).toBe("");
  });
});

describe("segmentShares", () => {
  it("returns percentages that sum to 100", () => {
    const shares = segmentShares([1, 1, 2]);
    expect(shares).toEqual([25, 25, 50]);
  });

  it("returns zeros, not NaN, when everything is zero", () => {
    expect(segmentShares([0, 0])).toEqual([0, 0]);
  });

  it("ignores negative values", () => {
    expect(segmentShares([-4, 4])).toEqual([0, 100]);
  });
});
