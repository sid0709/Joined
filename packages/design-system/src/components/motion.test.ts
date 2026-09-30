import { describe, expect, it } from "bun:test";

import { cubicBezier, lerpBox, parseDuration, parseEasing } from "./motion";

describe("parseDuration", () => {
  it("reads milliseconds and seconds", () => {
    expect(parseDuration("300ms")).toBe(300);
    expect(parseDuration(" 0.41s ")).toBe(410);
  });

  it("falls back to 0 so motion snaps", () => {
    expect(parseDuration("")).toBe(0);
    expect(parseDuration("fast")).toBe(0);
    expect(parseDuration("-5ms")).toBe(0);
  });
});

describe("cubicBezier", () => {
  const ease = cubicBezier(0.24, 1, 0.4, 1);

  it("starts at 0 and ends at 1", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it("never goes backwards", () => {
    let previous = 0;
    for (let x = 0; x <= 1; x += 0.01) {
      const y = ease(x);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = y;
    }
  });

  it("matches a linear curve exactly", () => {
    const line = cubicBezier(0, 0, 1, 1);
    for (const x of [0.1, 0.25, 0.5, 0.9]) expect(line(x)).toBeCloseTo(x, 4);
  });

  it("decelerates: most of the travel happens early", () => {
    expect(ease(0.25)).toBeGreaterThan(0.6);
  });
});

describe("parseEasing", () => {
  it("reads a cubic-bezier token", () => {
    expect(parseEasing("cubic-bezier(0.24, 1, 0.4, 1)")(0.25)).toBeGreaterThan(0.6);
  });

  it("falls back to linear", () => {
    expect(parseEasing("ease")(0.5)).toBe(0.5);
    expect(parseEasing("cubic-bezier(1, 2)")(0.5)).toBe(0.5);
  });
});

describe("lerpBox", () => {
  it("interpolates position and width", () => {
    expect(lerpBox({ x: 0, width: 40 }, { x: 100, width: 140 }, 0.5)).toEqual({
      x: 50,
      width: 90,
    });
  });
});
