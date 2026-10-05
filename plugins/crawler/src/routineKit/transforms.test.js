import { describe, expect, test } from "bun:test";

import { applyTransforms, isKnownTransform } from "./transforms.js";

describe("applyTransforms", () => {
  test("runs transforms in order", () => {
    expect(applyTransforms("  a\n\n b \n", ["lines"])).toEqual(["a", "b"]);
    expect(applyTransforms("  Acme · ", [["replace", " · ", ""], "trim"])).toBe("Acme");
  });

  test("replace changes only the first occurrence and defaults to removing it", () => {
    expect(applyTransforms("a-b-c", [["replace", "-"]])).toBe("ab-c");
  });

  test("countedText keeps the text and its first number", () => {
    expect(applyTransforms("Over 120 applicants, 3 days", ["countedText"])).toEqual({
      count: 120,
      text: "Over 120 applicants, 3 days",
    });
    expect(applyTransforms("", ["countedText"])).toEqual({ count: 0, text: "" });
  });

  test("httpUrl keeps only http(s) URLs", () => {
    expect(applyTransforms(" https://acme.com ", ["httpUrl"])).toBe("https://acme.com");
    expect(applyTransforms("javascript:alert(1)", ["httpUrl"])).toBe("");
    expect(applyTransforms("not a url", ["httpUrl"])).toBe("");
    expect(applyTransforms(null, ["httpUrl"])).toBe("");
  });

  test("treats a missing value as empty", () => {
    expect(applyTransforms(undefined, ["trim"])).toBe("");
    expect(applyTransforms(null, ["lines"])).toEqual([]);
    expect(applyTransforms("kept")).toBe("kept");
  });

  test("rejects unknown transforms", () => {
    expect(isKnownTransform("lines")).toBe(true);
    expect(isKnownTransform(["replace", "a", "b"])).toBe(true);
    expect(isKnownTransform("toString")).toBe(false);
    expect(() => applyTransforms("x", ["shout"])).toThrow("Unknown transform: shout");
  });
});
