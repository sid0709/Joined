import { describe, expect, it } from "bun:test";

import {
  arcPath,
  areaPath,
  compactNumber,
  conversionRates,
  heatLevel,
  linePath,
  linearScale,
  nearestIndex,
  niceTicks,
  segmentShares,
} from "./chartMath";

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

describe("niceTicks", () => {
  it("rounds the top up to a clean step", () => {
    expect(niceTicks(17, 4)).toEqual([0, 5, 10, 15, 20]);
  });

  it("handles fractional maxima", () => {
    expect(niceTicks(0.9, 3)).toEqual([0, 0.5, 1]);
  });

  it("gives an empty chart a frame", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range, inverted for SVG y", () => {
    const y = linearScale([0, 10], [100, 0]);
    expect(y(0)).toBe(100);
    expect(y(5)).toBe(50);
    expect(y(10)).toBe(0);
  });

  it("maps a flat domain to the range start", () => {
    expect(linearScale([3, 3], [0, 50])(3)).toBe(0);
  });
});

describe("paths", () => {
  it("draws a line and closes an area to the baseline", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 5, y: 0 },
    ];
    expect(linePath(points)).toBe("M0,10L5,0");
    expect(areaPath(points, 20)).toBe("M0,10L5,0L5,20L0,20Z");
    expect(areaPath([], 20)).toBe("");
  });

  it("returns nothing for an empty arc", () => {
    expect(arcPath(10, 10, 5, 10, 0.2, 0.2)).toBe("");
    expect(arcPath(10, 10, 5, 10, 0, 0.25).startsWith("M10,0A10,10")).toBe(true);
  });
});

describe("heatLevel", () => {
  it("keeps zero at level zero and any activity at level one or more", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 100)).toBe(1);
    expect(heatLevel(10, 10)).toBe(4);
  });
});

describe("nearestIndex", () => {
  it("snaps to the closest x", () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20], 16)).toBe(2);
  });
});

describe("conversionRates", () => {
  it("reports each step against the one before", () => {
    expect(conversionRates([40, 20, 5])).toEqual([100, 50, 25]);
    expect(conversionRates([0, 3])).toEqual([100, 0]);
  });
});

describe("compactNumber", () => {
  it("abbreviates large figures", () => {
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(12_400)).toBe("12.4K");
  });
});
