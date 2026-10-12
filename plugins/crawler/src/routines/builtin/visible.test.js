import { describe, expect, test } from "bun:test";

import { documentFromHtml } from "./html.js";
import "./testing/domParser.js";
import { isVisibleElement } from "./visible.js";

describe("isVisibleElement", () => {
  test("treats display:none, x-cloak, and hidden ancestors as not visible", () => {
    const document = documentFromHtml(`
      <span id="ok">Saved</span>
      <span id="none" style="display: none;">Saved</span>
      <span id="cloak" x-cloak>Saved</span>
      <div style="display: none;"><span id="nested">Saved</span></div>
      <span id="vis" style="visibility: hidden;">Saved</span>
    `);
    expect(isVisibleElement(document.getElementById("ok"))).toBe(true);
    expect(isVisibleElement(document.getElementById("none"))).toBe(false);
    expect(isVisibleElement(document.getElementById("cloak"))).toBe(false);
    expect(isVisibleElement(document.getElementById("nested"))).toBe(false);
    expect(isVisibleElement(document.getElementById("vis"))).toBe(false);
    expect(isVisibleElement(null)).toBe(false);
  });

  test("uses getComputedStyle for class-based hidden nodes", () => {
    const document = documentFromHtml(`<span id="hidden" class="d-none">Saved</span>`);
    const node = document.getElementById("hidden");
    const view = {
      getComputedStyle: (el) =>
        el === node ? { display: "none", visibility: "visible", position: "static" } : {},
    };
    Object.defineProperty(document, "defaultView", { configurable: true, value: view });
    expect(isVisibleElement(node)).toBe(false);
  });
});
