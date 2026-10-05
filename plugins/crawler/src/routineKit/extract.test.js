import { describe, expect, spyOn, test } from "bun:test";

import { extractField, queryAll, readElement, waitForMatches } from "./extract.js";
import { attr, html, pairs, prop, rawText, text } from "./fields.js";
import { fakeElement, fakeRoot } from "./testing/fakeDom.js";

describe("queryAll", () => {
  test("uses the first selector in the list that matches", () => {
    const hit = fakeElement({ text: "hit" });
    const root = fakeRoot({ ".fallback": [hit] });
    expect(queryAll(root, [".stable", ".fallback"])).toEqual([hit]);
    expect(queryAll(root, ".stable")).toEqual([]);
  });

  test("skips a selector the page rejects", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const hit = fakeElement();
    const root = {
      querySelectorAll: (selector) => {
        if (selector === "[bad") throw new Error("SyntaxError");
        return selector === ".ok" ? [hit] : [];
      },
    };
    expect(queryAll(root, ["[bad", ".ok"])).toEqual([hit]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("waitForMatches", () => {
  test("resolves once the selector matches", async () => {
    const children = {};
    const root = fakeRoot(children);
    setTimeout(() => (children[".late"] = [fakeElement()]), 5);
    expect(await waitForMatches(root, ".late", 1000, 1)).toHaveLength(1);
  });

  test("resolves with no matches after the timeout", async () => {
    expect(await waitForMatches(fakeRoot({}), ".never", 5, 1)).toEqual([]);
  });
});

describe("readElement", () => {
  const element = fakeElement({
    text: "Rendered",
    textContent: "Raw",
    attrs: { alt: "Logo" },
    props: { href: "https://acme.com/a", tabIndex: 0 },
  });

  test("reads each kind of value", () => {
    expect(readElement(element, "text")).toBe("Rendered");
    expect(readElement(element, "textContent")).toBe("Raw");
    expect(readElement(element, "html")).toBe("<fake>Rendered</fake>");
    expect(readElement(element, "attr:alt")).toBe("Logo");
    expect(readElement(element, "attr:title")).toBe("");
    expect(readElement(element, "prop:href")).toBe("https://acme.com/a");
    expect(readElement(element, "prop:tabIndex")).toBe("0");
    expect(readElement(element, "prop:missing")).toBe("");
    expect(readElement(element, "style:color")).toBe("");
    expect(readElement(null, "text")).toBe("");
  });
});

describe("extractField", () => {
  const root = fakeRoot({
    h1: [fakeElement({ text: "Engineer" })],
    section: [
      fakeElement({ text: "One" }),
      fakeElement({ text: "" }),
      fakeElement({ text: "Three" }),
    ],
    a: [fakeElement({ props: { href: "https://acme.com/apply" } })],
    "h2.row": [
      fakeElement({
        children: { span: [fakeElement({ text: "Acme" }), fakeElement({ text: "2 days ago · " })] },
      }),
    ],
    ".tags": [
      fakeElement({
        children: { span: [fakeElement({ text: "AI" }), fakeElement({ text: "SaaS" })] },
      }),
    ],
    ".meta": [
      fakeElement({
        children: {
          ".item": [
            fakeElement({
              children: {
                img: [fakeElement({ attrs: { alt: "location" } })],
                span: [fakeElement({ textContent: " Remote " })],
              },
            }),
            fakeElement({
              children: { img: [fakeElement({ attrs: { alt: "salary" } })] },
            }),
          ],
        },
      }),
    ],
  });

  test("reads a single match", () => {
    expect(extractField(root, text("h1"))).toEqual({ found: true, value: "Engineer" });
    expect(extractField(root, rawText("h1")).value).toBe("Engineer");
    expect(extractField(root, html("h1")).value).toBe("<fake>Engineer</fake>");
    expect(extractField(root, prop("a", "href")).value).toBe("https://acme.com/apply");
  });

  test("reads a match inside a match", () => {
    expect(extractField(root, text("h2.row", { inner: "span" })).value).toBe("Acme");
    const posted = text("h2.row", { inner: "span", innerNth: 1, then: [["replace", " · ", ""]] });
    expect(extractField(root, posted).value).toBe("2 days ago");
    expect(extractField(root, text("h2.row", { nth: 3, inner: "span" })).value).toBe("");
    expect(extractField(root, text("h2.row", { inner: "b" })).value).toBe("");
  });

  test("reads several matches", () => {
    expect(extractField(root, text(".tags", { inner: "span", all: true })).value).toEqual([
      "AI",
      "SaaS",
    ]);
    expect(extractField(root, text("section", { all: true })).value).toEqual(["One", "", "Three"]);
    expect(extractField(root, text("section", { nth: [0, 1, 2, 5], join: "\n\n" })).value).toBe(
      "One\n\nThree",
    );
    expect(extractField(root, text("section", { nth: [2, 0] })).value).toEqual(["Three", "One"]);
  });

  test("builds an object from pairs and drops incomplete ones", () => {
    const field = pairs(".meta", {
      inner: ".item",
      key: ["img", "attr:alt"],
      value: ["span", "textContent"],
    });
    expect(extractField(root, field).value).toEqual({ location: "Remote" });
    const self = pairs("h1", { key: [null, "text"], value: [null, "text"] });
    expect(extractField(root, self).value).toEqual({ Engineer: "Engineer" });
  });

  test("reads a missing element as empty and still runs its transforms", () => {
    expect(extractField(root, text(".none"))).toEqual({ found: false, value: "" });
    expect(extractField(root, text(".none", { then: ["lines"] })).value).toEqual([]);
    expect(extractField(root, text(".none", { then: ["countedText"] })).value).toEqual({
      count: 0,
      text: "",
    });
    expect(extractField(root, attr(".none", "alt", { all: true })).value).toEqual([]);
    expect(
      extractField(root, pairs(".none", { key: ["i", "text"], value: ["b", "text"] })).value,
    ).toEqual({});
  });
});
