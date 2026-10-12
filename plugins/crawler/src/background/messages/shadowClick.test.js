import { afterEach, describe, expect, test } from "bun:test";

import {
  HEART_CLICK_HEART,
  HEART_CLICK_HOST,
  HEART_CLICK_SVG,
} from "../../routines/builtin/constants.js";

import { clickSaveInDocument, clickShadowInMainWorld } from "./shadowClick.js";

afterEach(() => {
  delete globalThis.chrome;
});

function clickable(label, extra = {}) {
  const node = {
    events: [],
    click() {
      node.events.push("click");
    },
    dispatchEvent(event) {
      node.events.push(event?.type || "event");
      return true;
    },
    label,
    ...extra,
  };
  return node;
}

function heartTree({ svg = true, prefix = true } = {}) {
  const svgNode = svg
    ? clickable("svg", {
        getAttribute: (name) => (name === "data-prefix" && prefix ? "far" : ""),
      })
    : null;
  const prefixNode = prefix
    ? clickable("prefix", {
        getAttribute: (name) => (name === "data-prefix" ? "far" : ""),
      })
    : null;
  const heart = clickable("heart", {
    querySelector(selector) {
      if (selector === "svg") return svgNode;
      if (selector === "[data-prefix]") return prefixNode;
      return null;
    },
  });
  const host = clickable("host", {
    shadowRoot: {
      querySelector(selector) {
        return selector === "div.heart" ? heart : null;
      },
    },
  });
  return { heart, host, svgNode, prefixNode };
}

describe("clickSaveInDocument", () => {
  test("dispatches pointer and mouse events and clicks div.heart once", () => {
    const { heart, host } = heartTree();
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => host })).toEqual({
      found: true,
      clicked: true,
      which: HEART_CLICK_HEART,
    });
    expect(heart.events).toEqual(["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
    expect(host.events).toEqual([]);
  });

  test("clicks only the svg when which is svg", () => {
    const { heart, host, svgNode } = heartTree();
    expect(
      clickSaveInDocument("my-item", "div.heart", { querySelector: () => host }, HEART_CLICK_SVG),
    ).toEqual({ found: true, clicked: true, which: HEART_CLICK_SVG });
    expect(svgNode.events.filter((type) => type === "click")).toEqual(["click"]);
    expect(heart.events).toEqual([]);
    expect(host.events).toEqual([]);
  });

  test("clicks only the host when which is host", () => {
    const { heart, host } = heartTree();
    expect(
      clickSaveInDocument("my-item", "div.heart", { querySelector: () => host }, HEART_CLICK_HOST),
    ).toEqual({ found: true, clicked: true, which: HEART_CLICK_HOST });
    expect(host.events.filter((type) => type === "click")).toEqual(["click"]);
    expect(heart.events).toEqual([]);
  });

  test("falls back to [data-prefix] when the heart has no svg", () => {
    const { host, prefixNode } = heartTree({ svg: false });
    expect(
      clickSaveInDocument("my-item", "div.heart", { querySelector: () => host }, HEART_CLICK_SVG),
    ).toEqual({ found: true, clicked: true, which: HEART_CLICK_SVG });
    expect(prefixNode.events.filter((type) => type === "click")).toEqual(["click"]);
  });

  test("returns found false when the host is missing", () => {
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => null })).toEqual({
      found: false,
      clicked: false,
      which: HEART_CLICK_HEART,
    });
  });

  test("does not click when the heart is missing", () => {
    const host = { shadowRoot: { querySelector: () => null } };
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => host })).toEqual({
      found: true,
      clicked: false,
      which: HEART_CLICK_HEART,
    });
  });

  test("does not click when the svg target is missing", () => {
    const { host } = heartTree({ svg: false, prefix: false });
    expect(
      clickSaveInDocument("my-item", "div.heart", { querySelector: () => host }, HEART_CLICK_SVG),
    ).toEqual({ found: true, clicked: false, which: HEART_CLICK_SVG });
  });

  test("returns clicked false when click throws", () => {
    const heart = {
      dispatchEvent() {
        return true;
      },
      click() {
        throw new Error("blocked");
      },
    };
    const host = { shadowRoot: { querySelector: () => heart } };
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => host })).toEqual({
      found: true,
      clicked: false,
      which: HEART_CLICK_HEART,
    });
  });

  test("falls back to Event when the first dispatchEvent throws", () => {
    const events = [];
    let failed = false;
    const heart = {
      dispatchEvent(event) {
        if (!failed) {
          failed = true;
          throw new Error("no constructor");
        }
        events.push(event.type);
        return true;
      },
      click() {
        events.push("click");
      },
    };
    const host = { shadowRoot: { querySelector: () => heart } };
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => host })).toEqual({
      found: true,
      clicked: true,
      which: HEART_CLICK_HEART,
    });
    expect(events).toEqual(["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
  });
});

describe("clickShadowInMainWorld", () => {
  test("runs clickSaveInDocument in the page MAIN world", async () => {
    const calls = [];
    globalThis.chrome = {
      scripting: {
        executeScript: async (options) => {
          calls.push(options);
          return [{ result: { found: true, clicked: true, which: HEART_CLICK_HEART } }];
        },
      },
    };
    await expect(
      clickShadowInMainWorld(9, { host: "my-item", inner: "div.heart", which: HEART_CLICK_HEART }),
    ).resolves.toEqual({ found: true, clicked: true, which: HEART_CLICK_HEART });
    expect(calls).toEqual([
      {
        target: { tabId: 9, frameIds: [0] },
        world: "MAIN",
        func: clickSaveInDocument,
        args: ["my-item", "div.heart", null, HEART_CLICK_HEART],
      },
    ]);
  });

  test("returns not found when the page returns no result", async () => {
    globalThis.chrome = {
      scripting: {
        executeScript: async () => [{}],
      },
    };
    await expect(clickShadowInMainWorld(3, { which: HEART_CLICK_HOST })).resolves.toEqual({
      found: false,
      clicked: false,
      which: HEART_CLICK_HOST,
    });
  });
});
