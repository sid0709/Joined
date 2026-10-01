import { describe, expect, it } from "bun:test";

import { deleteCode, insertCode, sanitizeCode, typedCharacters } from "./codeInputRules";

describe("CodeInput helpers", () => {
  it("keeps only allowed characters", () => {
    expect(sanitizeCode("12 3-4a5")).toBe("12345");
    expect(sanitizeCode("a1-b2", "alphanumeric")).toBe("A1B2");
  });

  it("types a digit and moves focus forward", () => {
    expect(insertCode("12", 2, "3", 6)).toEqual({ value: "123", focusIndex: 3 });
  });

  it("overwrites a filled cell without shifting the rest", () => {
    expect(insertCode("123456", 2, "9", 6)).toEqual({ value: "129456", focusIndex: 3 });
  });

  it("writes at the end of the value when a later cell is used", () => {
    expect(insertCode("1", 4, "2", 6)).toEqual({ value: "12", focusIndex: 2 });
  });

  it("ignores characters that are not allowed", () => {
    expect(insertCode("12", 2, "x", 6)).toEqual({ value: "12", focusIndex: 2 });
  });

  it("spreads a paste across cells and caps it at the length", () => {
    expect(insertCode("1", 1, "234", 6)).toEqual({ value: "1234", focusIndex: 4 });
    expect(insertCode("12", 2, "34567890", 6)).toEqual({ value: "345678", focusIndex: 5 });
  });

  it("keeps focus on the last cell when the code is full", () => {
    expect(insertCode("12345", 5, "6", 6)).toEqual({ value: "123456", focusIndex: 5 });
  });

  it("clears the focused cell, then steps back when it is empty", () => {
    expect(deleteCode("123456", 5)).toEqual({ value: "12345", focusIndex: 5 });
    expect(deleteCode("123", 1)).toEqual({ value: "13", focusIndex: 1 });
    expect(deleteCode("123", 3)).toEqual({ value: "12", focusIndex: 2 });
    expect(deleteCode("", 0)).toEqual({ value: "", focusIndex: 0 });
  });

  it("finds what was typed into a cell that kept its character", () => {
    expect(typedCharacters("5", undefined)).toBe("5");
    expect(typedCharacters("15", "1")).toBe("5");
    expect(typedCharacters("51", "1")).toBe("5");
    expect(typedCharacters("7", "1")).toBe("7");
  });
});
