import { expect, test } from "bun:test";

import { listingHref, listingUrlChange } from "./listing";

test("sets, replaces, and drops query values", () => {
  const current = new URLSearchParams("q=old&page=3&job=a");
  expect(listingHref("/jobs", current, { q: "new", page: 1, job: null })).toBe("/jobs?q=new");
  expect(listingHref("/jobs", current, { page: 2 })).toBe("/jobs?q=old&page=2&job=a");
  expect(listingHref("/jobs", new URLSearchParams(), { q: "" })).toBe("/jobs");
});

test("listing url change skips a no-op and keeps query-only hrefs on the path", () => {
  const here = { pathname: "/jobs", search: "?page=2" };
  expect(listingUrlChange(here, "/jobs?page=2")).toBeNull();
  expect(listingUrlChange(here, "?page=3")).toBe("/jobs?page=3");
  expect(listingUrlChange({ pathname: "/jobs", search: "" }, "/companies")).toBe("/companies");
});
