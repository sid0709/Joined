import { expect, test } from "bun:test";

import { listingHref } from "./listing";

test("sets, replaces, and drops query values", () => {
  const current = new URLSearchParams("q=old&page=3&job=a");
  expect(listingHref("/jobs", current, { q: "new", page: 1, job: null })).toBe("/jobs?q=new");
  expect(listingHref("/jobs", current, { page: 2 })).toBe("/jobs?q=old&page=2&job=a");
  expect(listingHref("/jobs", new URLSearchParams(), { q: "" })).toBe("/jobs");
});
