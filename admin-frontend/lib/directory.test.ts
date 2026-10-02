import { expect, test } from "bun:test";

import {
  COMPLETION_HIGH,
  COMPLETION_MID,
  COMPLETION_OPTIONS,
  completionTier,
  directoryParams,
  sortValues,
  tableSort,
  type DirectoryFilter,
} from "./directory";

const FILTERS: DirectoryFilter[] = [{ param: "industry", label: "Industry", options: [] }];

test("directoryParams passes search, sort, and filters, and splits the completion range", () => {
  const current = new URLSearchParams({
    q: "acme",
    sort: "jobs",
    dir: "desc",
    industry: "Fintech",
    completion: COMPLETION_OPTIONS[1].value,
    company: "abc123",
  });
  const params = directoryParams(current, FILTERS, 2, 25);
  expect(params.get("page")).toBe("2");
  expect(params.get("pageSize")).toBe("25");
  expect(params.get("q")).toBe("acme");
  expect(params.get("sort")).toBe("jobs");
  expect(params.get("dir")).toBe("desc");
  expect(params.get("industry")).toBe("Fintech");
  expect(params.get("minCompletion")).toBe(String(COMPLETION_HIGH));
  expect(params.get("maxCompletion")).toBe("100");
  // The open drawer is page state, not a filter.
  expect(params.has("company")).toBe(false);
});

test("tableSort reads the URL and falls back to the page default", () => {
  const fallback = { key: "name", direction: "asc" } as const;
  expect(tableSort(new URLSearchParams(), fallback)).toEqual(fallback);
  expect(tableSort(new URLSearchParams({ sort: "jobs", dir: "desc" }), fallback)).toEqual({
    key: "jobs",
    direction: "desc",
  });
  expect(sortValues(null)).toEqual({ sort: null, dir: null, page: 1 });
});

test("completionTier colors complete, partial, and thin", () => {
  expect(completionTier(COMPLETION_HIGH)).toBe("success");
  expect(completionTier(COMPLETION_MID)).toBe("warning");
  expect(completionTier(COMPLETION_MID - 1)).toBe("error");
});
