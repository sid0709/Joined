import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import {
  clickLikeHuman,
  randomBetween,
  setNativeValue,
  supportsSelectionRange,
  wait,
} from "./dom.js";

const { window, document } = parseHTML(
  `<!DOCTYPE html><html><body><input id="text" type="text" /></body></html>`,
);
globalThis.window = window;
globalThis.document = document;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement;
globalThis.HTMLInputElement = window.HTMLInputElement;

describe("dom helpers", () => {
  test("setNativeValue writes through a stand-in input and ignores a missing node", () => {
    setNativeValue(null, "typed");
    const input = document.getElementById("text");
    setNativeValue(input, "from-native");
    expect(input.value).toBe("from-native");
  });

  test("supportsSelectionRange is false for email and nodes that cannot select", () => {
    expect(supportsSelectionRange(null)).toBe(false);
    expect(supportsSelectionRange({ type: "text" })).toBe(false);
    expect(
      supportsSelectionRange({
        type: "text",
        setSelectionRange() {},
      }),
    ).toBe(true);
    expect(
      supportsSelectionRange({
        type: "email",
        setSelectionRange() {},
      }),
    ).toBe(false);
    expect(
      supportsSelectionRange({
        getAttribute: () => "number",
        setSelectionRange() {},
      }),
    ).toBe(false);
  });

  test("wait resolves and randomBetween stays inside the range", async () => {
    await wait(0);
    const value = randomBetween(2, 4);
    expect(value).toBeGreaterThanOrEqual(2);
    expect(value).toBeLessThanOrEqual(4);
  });

  test("clickLikeHuman scrolls an off-screen node and swallows event failures", () => {
    const scrolled = [];
    const clicks = [];
    clickLikeHuman(null);
    clickLikeHuman({
      getBoundingClientRect: () => ({ top: -20, left: 0, bottom: -4, right: 10 }),
      scrollIntoView: (opts) => scrolled.push(opts),
      dispatchEvent: () => {
        throw new Error("no events");
      },
      click: () => clicks.push(1),
    });
    expect(scrolled).toEqual([{ block: "nearest", inline: "nearest" }]);
    expect(clicks).toEqual([1]);
  });
});
