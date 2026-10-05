import { describe, expect, test } from "bun:test";

import {
  describeRead,
  describeSelector,
  describeStep,
  describeTransforms,
  fieldLabel,
  humanizePath,
} from "./describe.js";
import { text } from "./fields.js";
import { clearHighlights, click, highlight, pause, waitFor, waitGone } from "./steps.js";

describe("describe", () => {
  test("turns field paths into labels, unless the field has its own", () => {
    expect(humanizePath("company.name")).toBe("Company name");
    expect(humanizePath("applyLink")).toBe("Apply link");
    expect(fieldLabel("applyLink", text("a"))).toBe("Apply link");
    expect(fieldLabel("applyLink", text("a", { label: "Apply URL" }))).toBe("Apply URL");
  });

  test("describes selectors, reads, and transforms", () => {
    expect(describeSelector([".a", ".b"])).toBe(".a | .b");
    expect(describeSelector(undefined)).toBe("");
    expect(describeRead("text")).toBe("Text");
    expect(describeRead("pairs")).toBe("Key/value pairs");
    expect(describeRead("attr:alt")).toBe("Attribute alt");
    expect(describeRead("prop:href")).toBe("Property href");
    expect(describeTransforms(["lines", ["replace", "a", "b"]])).toEqual(["lines", "replace"]);
    expect(describeTransforms()).toEqual([]);
  });

  test("describes each step, preferring its label", () => {
    expect(describeStep(click(".next"))).toBe("Click .next");
    expect(describeStep(click(".next", { label: "Open next job" }))).toBe("Open next job");
    expect(describeStep(highlight(".card"))).toBe("Highlight .card");
    expect(describeStep(clearHighlights())).toBe("Clear highlights");
    expect(describeStep(pause(250))).toBe("Pause 250 ms");
    expect(describeStep(waitFor(".pane"))).toBe("Wait for .pane");
    expect(describeStep(waitGone(".pane"))).toBe("Wait for .pane to go away");
    expect(describeStep({ kind: "teleport" })).toBe("teleport");
  });
});
