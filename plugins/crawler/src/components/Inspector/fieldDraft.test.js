import { describe, expect, test } from "bun:test";

import { routineProblems } from "../../routineKit/routine";
import { listDetail } from "../../routineKit/strategies";

import { draftToField, draftToSnippet, EMPTY_DRAFT, isDraftComplete } from "./fieldDraft";

const draft = (changes) => ({ ...EMPTY_DRAFT, ...changes });

describe("Inspector field drafts", () => {
  test("needs a selector, and a name for attributes and properties", () => {
    expect(isDraftComplete(EMPTY_DRAFT)).toBe(false);
    expect(isDraftComplete(draft({ selector: "h1" }))).toBe(true);
    expect(isDraftComplete(draft({ selector: "a", read: "attr" }))).toBe(false);
    expect(isDraftComplete(draft({ selector: "a", read: "attr", name: "href" }))).toBe(true);
    expect(isDraftComplete(draft({ selector: "h1", read: "unknown" }))).toBe(true);
  });

  test("writes the shortest routine code for the draft", () => {
    expect(draftToSnippet(draft({ selector: " h1 " }))).toBe('text("h1")');
    expect(draftToSnippet(draft({ selector: "a", read: "prop", name: "href" }))).toBe(
      'prop("a", "href")',
    );
    expect(
      draftToSnippet(
        draft({
          selector: "ul",
          read: "textContent",
          nth: 2,
          inner: "li",
          all: true,
          transform: "trim",
        }),
      ),
    ).toBe('rawText("ul", { nth: 2, inner: "li", all: true, then: ["trim"] })');
    expect(draftToSnippet(draft({ selector: "main", read: "html" }))).toBe('html("main")');
  });

  test("builds a field a routine accepts", () => {
    const field = draftToField(
      draft({ selector: "img", read: "attr", name: "alt", transform: "lines" }),
      500,
    );
    expect(field).toMatchObject({
      kind: "field",
      selector: "img",
      read: "attr:alt",
      then: ["lines"],
      wait: 500,
    });
    const routine = {
      id: "draft",
      label: "Draft",
      version: 1,
      match: { hosts: ["jobs.example"] },
      output: "job",
      strategy: listDetail({}),
      fields: { value: field },
    };
    expect(routineProblems(routine)).toEqual([]);
    expect(draftToField(draft({ selector: "h1" })).wait).toBe(0);
  });
});
