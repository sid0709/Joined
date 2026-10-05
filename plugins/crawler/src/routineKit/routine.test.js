import { describe, expect, test } from "bun:test";

import { attr, pairs, text } from "./fields.js";
import { DEFAULT_ROUTINE_OPTIONS, defineRoutine, listFields, routineProblems } from "./routine.js";
import { click, highlight, pause, waitFor, waitGone } from "./steps.js";
import { listDetail } from "./strategies.js";

const validRoutine = () => ({
  id: "example",
  label: "Example",
  version: 1,
  match: { hosts: ["jobs.example"] },
  output: "job",
  strategy: listDetail({
    open: [highlight(".card"), click(".card a")],
    ready: [waitFor(".detail")],
    dismiss: [waitGone(".detail")],
    settle: [pause(10)],
  }),
  fields: {
    title: text("h1"),
    "company.logo": attr("img", "src"),
    details: pairs(".meta", { key: ["img", "attr:alt"], value: ["span", "text"] }),
  },
});

describe("defineRoutine", () => {
  test("accepts a valid routine and fills in default options", () => {
    const routine = defineRoutine(validRoutine());
    expect(routine.options).toEqual(DEFAULT_ROUTINE_OPTIONS);
    expect(Object.isFrozen(routine)).toBe(true);
    expect(defineRoutine({ ...validRoutine(), options: { fieldPauseMs: 50 } }).options).toEqual({
      highlightFields: true,
      fieldPauseMs: 50,
    });
  });

  test("lists fields in the order they are read", () => {
    expect(listFields(defineRoutine(validRoutine())).map(({ path }) => path)).toEqual([
      "title",
      "company.logo",
      "details",
    ]);
  });

  test("throws with every problem when the routine is invalid", () => {
    expect(() => defineRoutine({ ...validRoutine(), id: "", label: "" })).toThrow(
      'Invalid routine "": id is required; label is required.',
    );
  });
});

describe("routineProblems", () => {
  test("finds nothing wrong with a valid routine", () => {
    expect(routineProblems(validRoutine())).toEqual([]);
  });

  test("checks the routine's identity and match", () => {
    expect(routineProblems(null)).toEqual(["routine must be an object"]);
    expect(
      routineProblems({ ...validRoutine(), version: 0, output: "", match: { hosts: [] } }),
    ).toEqual([
      "version must be a positive whole number",
      "output is required",
      "match.hosts must list at least one host",
    ]);
  });

  test("checks the strategy and its steps", () => {
    expect(routineProblems({ ...validRoutine(), strategy: { kind: "teleport" } })).toEqual([
      'unknown strategy "teleport"',
    ]);
    const strategy = {
      ...listDetail({}),
      open: [{ kind: "dance" }, click(""), { kind: "pause" }],
      ready: "soon",
      dismiss: [click(".x", { onMissing: "panic" })],
    };
    expect(routineProblems({ ...validRoutine(), strategy })).toEqual([
      'open step 1 has unknown kind "dance"',
      "open step 2 needs a selector",
      "open step 3 needs ms",
      "strategy ready must be a list of steps",
      'dismiss step 1 has unknown onMissing "panic"',
    ]);
  });

  test("checks every field", () => {
    const fields = {
      raw: { selector: "h1" },
      noSelector: text([]),
      badRead: { ...text("h1"), read: "style:color" },
      badPair: pairs(".m", { key: ["img"], value: [7, "nope"] }),
      badNth: text("h1", { nth: -1, innerNth: 1.5, wait: -1 }),
      emptyNth: text("h1", { nth: [] }),
      innerWithList: text("h1", { nth: [0, 1], inner: "span" }),
      badInner: text("h1", { inner: " " }),
      badTransform: text("h1", { then: ["lines", "shout"] }),
    };
    expect(routineProblems({ ...validRoutine(), fields })).toEqual([
      'field "raw" must be built with text(), attr(), prop() or pairs()',
      'field "noSelector" needs a selector',
      'field "badRead" has unknown read "style:color"',
      'field "badPair" pair key must be [selector, read]',
      'field "badPair" pair value selector must be a string or null',
      'field "badPair" pair value has unknown read "nope"',
      'field "badNth" nth must be a whole number or a list of them',
      'field "badNth" innerNth must be a whole number',
      'field "badNth" wait must be a whole number of ms',
      'field "emptyNth" nth must be a whole number or a list of them',
      'field "innerWithList" cannot combine inner with a list nth',
      'field "badInner" inner must be a selector',
      'field "badTransform" uses unknown transform "shout"',
    ]);
    expect(routineProblems({ ...validRoutine(), fields: {} })).toEqual([
      "fields must define at least one field",
    ]);
  });
});
