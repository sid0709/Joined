import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { clickSaveInDocument, dispatchRealClick } from "./shadowClick.js";

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
