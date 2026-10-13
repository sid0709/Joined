import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import {
  clickLikeHuman,
  preventLinkNavigation,
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

  test("does not guard ancestor links for generic callers", () => {
    const document = linkedomDocument(`<!DOCTYPE html><html><body>
      <a href="/job/help-desk-coordinator-reqaaa1111111111">
        <button id="btn">Go</button>
      </a>
    </body></html>`);
    let documentClicks = 0;
    document.addEventListener("click", () => {
      documentClicks += 1;
    });
    clickLikeHuman(document.getElementById("btn"));
    expect(documentClicks).toBe(1);
  });
});

describe("preventLinkNavigation", () => {
  test("preventDefault on the ancestor link still lets a document listener fire", () => {
    const document = linkedomDocument(`<!DOCTYPE html><html><body>
      <a href="/job/help-desk-coordinator-reqaaa1111111111">
        <button id="btn">Mark Applied</button>
      </a>
    </body></html>`);
    const link = document.querySelector("a");
    const button = document.getElementById("btn");
    let documentClicks = 0;
    let defaultPreventedAtDocument = false;
    document.addEventListener("click", (event) => {
      documentClicks += 1;
      defaultPreventedAtDocument = event.defaultPrevented;
    });
    const release = preventLinkNavigation(button);
    try {
      button.click();
    } finally {
      release();
    }
    expect(documentClicks).toBe(1);
    expect(defaultPreventedAtDocument).toBe(true);
    expect(link.contains(button)).toBe(true);
  });

  test("removes the link listener even when the click throws", () => {
    const document = linkedomDocument(`<!DOCTYPE html><html><body>
      <a href="/job/help-desk-coordinator-reqaaa1111111111">
        <button id="btn">Mark Applied</button>
      </a>
    </body></html>`);
    const link = document.querySelector("a");
    const button = document.getElementById("btn");
    const added = [];
    const removed = [];
    const nativeAdd = link.addEventListener.bind(link);
    const nativeRemove = link.removeEventListener.bind(link);
    link.addEventListener = (type, fn, options) => {
      added.push(fn);
      return nativeAdd(type, fn, options);
    };
    link.removeEventListener = (type, fn, options) => {
      removed.push(fn);
      return nativeRemove(type, fn, options);
    };
    const release = preventLinkNavigation(button);
    try {
      throw new Error("click failed");
    } catch {
      release();
    }
    expect(removed).toEqual(added);
    let leftoverPrevented = false;
    document.addEventListener("click", (event) => {
      leftoverPrevented = event.defaultPrevented;
    });
    button.click();
    expect(leftoverPrevented).toBe(false);
  });
});
