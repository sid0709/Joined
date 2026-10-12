import { afterEach, describe, expect, test } from "bun:test";

import { clickSaveInDocument, clickShadowInMainWorld } from "./shadowClick.js";

afterEach(() => {
  delete globalThis.chrome;
});

describe("clickSaveInDocument", () => {
  test("clicks only div.heart once", () => {
    const clicked = [];
    const heart = {
      click() {
        clicked.push("heart");
      },
    };
    const host = {
      shadowRoot: {
        querySelector(selector) {
          return selector === "div.heart" ? heart : null;
        },
      },
      click() {
        clicked.push("host");
      },
    };
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => host })).toEqual({
      found: true,
      clicked: true,
    });
    expect(clicked).toEqual(["heart"]);
  });

  test("returns found false when the host is missing", () => {
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => null })).toEqual({
      found: false,
      clicked: false,
    });
  });

  test("does not click when the heart is missing", () => {
    const host = { shadowRoot: { querySelector: () => null } };
    expect(clickSaveInDocument("my-item", "div.heart", { querySelector: () => host })).toEqual({
      found: true,
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
