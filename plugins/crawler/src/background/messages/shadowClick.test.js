import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { clickSaveInDocument, clickShadowInMainWorld, dispatchRealClick } from "./shadowClick.js";

class FakeEvent {
  constructor(type) {
    this.type = type;
  }
}

beforeEach(() => {
  globalThis.Event = FakeEvent;
  globalThis.MouseEvent = FakeEvent;
  globalThis.PointerEvent = FakeEvent;
});

afterEach(() => {
  delete globalThis.Event;
  delete globalThis.MouseEvent;
  delete globalThis.PointerEvent;
  delete globalThis.chrome;
});

describe("dispatchRealClick", () => {
  test("fires pointerdown, mousedown, pointerup, mouseup, then click", () => {
    const types = [];
    const node = {
      dispatchEvent(event) {
        types.push(event.type);
        return true;
      },
      click() {
        types.push("element.click");
      },
    };
    dispatchRealClick(node);
    expect(types).toEqual([
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "click",
      "element.click",
    ]);
  });

  test("falls back to Event when PointerEvent construction fails", () => {
    globalThis.PointerEvent = class {
      constructor() {
        throw new Error("no pointer");
      }
    };
    const types = [];
    dispatchRealClick({
      dispatchEvent(event) {
        types.push(event.type);
        return true;
      },
    });
    expect(types).toEqual(["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
  });

  test("ignores a missing node and a click that throws", () => {
    expect(dispatchRealClick(null)).toBeUndefined();
    expect(() =>
      dispatchRealClick({
        dispatchEvent() {
          return true;
        },
        click() {
          throw new Error("no click");
        },
      }),
    ).not.toThrow();
  });
});

describe("clickSaveInDocument", () => {
  test("clicks the heart, its svg, and the my-item host", () => {
    const clicked = [];
    const record = (name) => ({
      name,
      dispatchEvent(event) {
        clicked.push(`${name}:${event.type}`);
        return true;
      },
      click() {
        clicked.push(`${name}:element.click`);
      },
      querySelector(selector) {
        if (selector === "svg" || selector === "[data-prefix]") return svg;
        return null;
      },
    });
    const svg = record("svg");
    const heart = record("heart");
    const host = record("host");
    host.shadowRoot = {
      querySelector(selector) {
        return selector === "div.heart" ? heart : null;
      },
    };
    const root = {
      querySelector() {
        return host;
      },
    };
    expect(clickSaveInDocument("my-item", "div.heart", root)).toEqual({
      found: true,
      clicked: true,
    });
    expect(clicked.filter((item) => item.endsWith(":pointerdown"))).toEqual([
      "heart:pointerdown",
      "svg:pointerdown",
      "host:pointerdown",
    ]);
  });

  test("returns found false when the host is missing", () => {
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => null })).toEqual({
      found: false,
      clicked: false,
    });
  });
});

describe("clickShadowInMainWorld", () => {
  test("runs clickSaveInDocument in the page MAIN world", async () => {
    const calls = [];
    globalThis.chrome = {
      scripting: {
        executeScript: async (options) => {
          calls.push(options);
          return [{ result: { found: true, clicked: true } }];
        },
      },
    };
    await expect(
      clickShadowInMainWorld(9, { host: "my-item", inner: "div.heart" }),
    ).resolves.toEqual({ found: true, clicked: true });
    expect(calls).toEqual([
      {
        target: { tabId: 9, frameIds: [0] },
        world: "MAIN",
        func: clickSaveInDocument,
        args: ["my-item", "div.heart"],
      },
    ]);
  });

  test("returns not found when the page returns no result", async () => {
    globalThis.chrome = {
      scripting: {
        executeScript: async () => [{}],
      },
    };
    await expect(clickShadowInMainWorld(3, {})).resolves.toEqual({
      found: false,
      clicked: false,
    });
  });
});
