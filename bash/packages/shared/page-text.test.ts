import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PureNode } from "./tree-export.ts";
import { PAGE_TEXT_MAX_CHARS, extractVisiblePageText } from "./page-text.ts";

function node(tag: string, text: string | undefined, children: PureNode[] = []): PureNode {
  return { tag, id: 1, text, children };
}

describe("extractVisiblePageText", () => {
  it("drops form chrome and keeps body copy", () => {
    const tree = node("body", undefined, [
      node("h1", "Staff engineer"),
      node("p", "Build the platform"),
      node("input", "type your name"),
      node("button", "Apply now"),
      node("select", undefined, [node("option", "Full-time")]),
    ]);
    const text = extractVisiblePageText(tree, {
      title: "Acme role",
      url: "https://jobs.example.com/a",
    });
    assert.match(text, /^Acme role\nhttps:\/\/jobs\.example.com\/a\n\n/);
    assert.match(text, /Staff engineer/);
    assert.match(text, /Build the platform/);
    assert.doesNotMatch(text, /type your name/);
    assert.doesNotMatch(text, /Apply now/);
    assert.doesNotMatch(text, /Full-time/);
  });

  it("returns empty when there is no readable body text", () => {
    const tree = node("form", undefined, [node("input", "email"), node("button", "Submit")]);
    assert.equal(extractVisiblePageText(tree, { title: "Form", url: "https://x.test" }), "");
  });

  it("caps combined length", () => {
    const tree = node("p", "x".repeat(PAGE_TEXT_MAX_CHARS + 80));
    const text = extractVisiblePageText(tree, { title: "Role" });
    assert.equal(text.length, PAGE_TEXT_MAX_CHARS);
    assert.match(text, /^Role\n\n/);
  });
});
