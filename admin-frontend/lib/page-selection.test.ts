import { expect, test } from "bun:test";

import { isPageSelected, withPageSelection } from "./page-selection";

test("select all adds the page and keeps ids from other pages", () => {
  expect(withPageSelection(["a", "z"], ["a", "b"], true)).toEqual(["a", "z", "b"]);
  expect(isPageSelected(["a", "z", "b"], ["a", "b"])).toBe(true);
});

test("clearing the page leaves the rest of the selection", () => {
  expect(withPageSelection(["a", "z", "b"], ["a", "b"], false)).toEqual(["z"]);
  expect(isPageSelected(["z"], ["a", "b"])).toBe(false);
  expect(isPageSelected([], [])).toBe(false);
});
