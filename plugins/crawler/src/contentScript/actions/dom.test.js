import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import {
  clickLikeHuman,
  randomBetween,
  setNativeValue,
  supportsSelectionRange,
  wait,
} from "./dom.js";

function linkedomDocument(html) {
  const { document, window } = parseHTML(html);
  globalThis.document = document;
  globalThis.window = window;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
  return document;
}

describe("setNativeValue", () => {
  test("writes through the native value setter when available", () => {
    const document = linkedomDocument(`<!DOCTYPE html><html><body><input id="x" /></body></html>`);
    const input = document.getElementById("x");
    setNativeValue(input, "hello");
    expect(input.value).toBe("hello");
    setNativeValue(null, "ignored");
  });
});

describe("supportsSelectionRange", () => {
  test("allows text-like inputs and rejects unsupported types", () => {
    const document = linkedomDocument(
      `<!DOCTYPE html><html><body>
        <input id="text" type="text" />
        <input id="email" type="email" />
      </body></html>`,
    );
    const text = document.getElementById("text");
    text.setSelectionRange = () => {};
    expect(supportsSelectionRange(text)).toBe(true);
    expect(supportsSelectionRange(document.getElementById("email"))).toBe(false);
    expect(supportsSelectionRange(null)).toBe(false);
  });
});

describe("wait", () => {
  test("resolves after the named delay", async () => {
    const started = Date.now();
    await wait(5);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4);
  });
});

describe("randomBetween", () => {
  test("stays inside the inclusive range", () => {
    for (let index = 0; index < 20; index += 1) {
      const value = randomBetween(2, 4);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(4);
    }
  });
});

describe("clickLikeHuman", () => {
  test("scrolls when off-screen and dispatches pointer events before click", () => {
    const document = linkedomDocument(
      `<!DOCTYPE html><html><body><button id="btn">Go</button></body></html>`,
    );
    const button = document.getElementById("btn");
    const events = [];
    for (const type of ["mouseover", "mouseenter", "mousedown", "mouseup", "click"]) {
      button.addEventListener(type, () => events.push(type));
    }
    const scrollCalls = [];
    button.scrollIntoView = (opts) => scrollCalls.push(opts);
    button.getBoundingClientRect = () => ({
      top: 2000,
      left: 0,
      bottom: 2010,
      right: 10,
    });
    clickLikeHuman(button);

    expect(scrollCalls).toEqual([{ block: "nearest", inline: "nearest" }]);
    expect(events).toContain("click");
    clickLikeHuman(null);
  });

  test("swallows event failures after an off-screen scroll", () => {
    linkedomDocument(`<!DOCTYPE html><html><body></body></html>`);
    const scrolled = [];
    const clicks = [];
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
