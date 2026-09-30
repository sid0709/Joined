import { describe, expect, test } from "bun:test";

import { activeHref, breadcrumbs, railItems } from "./nav";

describe("nav", () => {
  test("a detail page keeps its list page active", () => {
    expect(activeHref("/submissions/abc")).toBe("/submissions");
    expect(activeHref("/earnings")).toBe("/earnings");
    expect(activeHref("/elsewhere")).toBeUndefined();
  });

  test("breadcrumbs end on the current page and nest pages under their area", () => {
    expect(breadcrumbs("/dashboard")).toEqual([{ label: "Overview" }]);
    expect(breadcrumbs("/payouts")).toEqual([
      { label: "Earnings", href: "/earnings" },
      { label: "Payouts" },
    ]);
    expect(breadcrumbs("/submissions/abc")).toEqual([
      { label: "Submissions", href: "/submissions" },
      { label: "Details" },
    ]);
    expect(breadcrumbs("/elsewhere")).toEqual([]);
  });

  test("the rail carries the in-review count on Submissions only", () => {
    const items = railItems(3);
    expect(items.find((item) => item.href === "/submissions")?.count).toBe(3);
    expect(items.filter((item) => item.count !== undefined)).toHaveLength(1);
    expect(items.find((item) => item.href === "/earnings")?.children).toHaveLength(2);
  });
});
