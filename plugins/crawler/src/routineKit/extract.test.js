import { describe, expect, spyOn, test } from "bun:test";

import {
  attrMatch,
  extractField,
  findElements,
  queryAll,
  queryOne,
  readElement,
  rewriteHashedSuffixes,
  valueMatchesPattern,
  waitForElements,
  waitForMatches,
} from "./extract.js";
import { attr, html, pairs, prop, rawText, text } from "./fields.js";
import { documentFromHtml } from "./html.js";
import { fakeElement, fakeRoot } from "./testing/fakeDom.js";
import "./testing/domParser.js";

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

const MATCHER_HTML = `
  <div id="job-card-9256204" class="index_job-title__Riiip">prefix card</div>
  <div id="job-card-11111111" class="index_job-title__Abcde">second card</div>
  <div id="mid" class="pre-gap-suf">mid gap</div>
  <div id="other" class="ends-with-flag">suffix</div>
  <a href="/jobs/info/abc">relative</a>
  <a href="https://jobright.ai/jobs/info/xyz">absolute</a>
`;

describe("Inspector attribute patterns", () => {
  test("matches prefix, suffix, contains, mid-gaps, and exact values", () => {
    expect(valueMatchesPattern("job-card-9256204", "job-card-?")).toBe(true);
    expect(valueMatchesPattern("x-job-card-9256204", "job-card-?")).toBe(false);
    expect(valueMatchesPattern("ends-with-flag", "?flag")).toBe(true);
    expect(valueMatchesPattern("flag-no", "?flag")).toBe(false);
    expect(valueMatchesPattern("index_job-title__Riiip extra", "?index_job-title__?")).toBe(true);
    expect(valueMatchesPattern("pre-gap-suf", "pre-?-suf")).toBe(true);
    expect(valueMatchesPattern("presuf", "pre?suf")).toBe(true);
    expect(valueMatchesPattern("preXXsuf", "pre-?-suf")).toBe(false);
    expect(valueMatchesPattern("exact", "exact")).toBe(true);
    expect(valueMatchesPattern("exacting", "exact")).toBe(false);
    expect(valueMatchesPattern("anything", "?")).toBe(true);
  });

  test("findElements is the Inspector helper and queryAll reuses it", () => {
    const document = documentFromHtml(MATCHER_HTML);
    const prefix = findElements("div", "id", "job-card-?", document);
    expect(prefix.map((node) => node.id)).toEqual(["job-card-9256204", "job-card-11111111"]);
    expect(
      queryAll(document, attrMatch({ tag: "div", attr: "id", pattern: "job-card-?" })),
    ).toEqual(prefix);
    expect(queryOne(document, attrMatch({ tag: "div", attr: "class", pattern: "?flag" }))?.id).toBe(
      "other",
    );
    expect(
      queryAll(document, attrMatch({ tag: "a", attr: "href", pattern: "?/jobs/info/?" })),
    ).toHaveLength(2);
    expect(
      queryOne(document, attrMatch({ tag: "div", attr: "class", pattern: "pre-?-suf" }))?.id,
    ).toBe("mid");
  });

  test("nth / order picks one node when a pattern matches several", () => {
    const document = documentFromHtml(MATCHER_HTML);
    const second = attrMatch({ tag: "div", attr: "id", pattern: "job-card-?", nth: 1 });
    expect(queryOne(document, second)?.id).toBe("job-card-11111111");
    expect(
      queryAll(
        document,
        attrMatch({ tag: "div", attr: "id", pattern: "job-card-?", nth: [0, 1] }),
      ).map((node) => node.id),
    ).toEqual(["job-card-9256204", "job-card-11111111"]);
    expect(
      queryAll(document, attrMatch({ tag: "div", attr: "id", pattern: "job-card-?", nth: 9 })),
    ).toEqual([]);
  });

  test("rewriting hashed class suffixes still matches contains patterns", () => {
    const rewritten = rewriteHashedSuffixes(MATCHER_HTML, "ZZZZ9");
    expect(rewritten).toContain("index_job-title__ZZZZ9");
    expect(rewritten).not.toContain("index_job-title__Riiip");
    const document = documentFromHtml(rewritten);
    const titles = queryAll(
      document,
      attrMatch({ tag: "div", attr: "class", pattern: "?index_job-title__?" }),
    );
    expect(titles.map((node) => node.textContent.trim())).toEqual(["prefix card", "second card"]);
    expect(
      queryOne(
        document,
        attrMatch({ tag: "div", attr: "class", pattern: "?index_job-title__?", nth: 1 }),
      )?.textContent,
    ).toContain("second card");
  });

  test("waitForElements resolves through the same matcher", async () => {
    const document = documentFromHtml('<div id="late-root"></div>');
    const pending = waitForElements("div", "id", "job-card-?", 200, 5, document);
    setTimeout(() => {
      const node = document.createElement("div");
      node.id = "job-card-42";
      document.body.append(node);
    }, 10);
    const found = await pending;
    expect(found?.[0]?.id).toBe("job-card-42");
    expect(await waitForElements("div", "id", "missing-?", 5, 1, document)).toBeNull();
  });
});
