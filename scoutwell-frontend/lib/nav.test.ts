import { describe, expect, test } from "bun:test";

import { activeHref, MARKETING_PAGES, navItems } from "./nav";

describe("nav", () => {
  test("a detail page keeps its list page active", () => {
    expect(activeHref("/submissions/abc")).toBe("/submissions");
    expect(activeHref("/earnings")).toBe("/earnings");
    expect(activeHref("/elsewhere")).toBeUndefined();
  });

  test("the longer matching page wins when one path contains another", () => {
    const pages = [
      { href: "/settings", label: "Settings", description: "Account settings." },
      { href: "/settings/billing", label: "Billing", description: "Payout method." },
    ];
    expect(activeHref("/settings/billing", pages)).toBe("/settings/billing");
    expect(activeHref("/settings/billing/tax", pages)).toBe("/settings/billing");
    expect(activeHref("/settings", pages)).toBe("/settings");
  });

  test("pills carry the in-review and unread counts", () => {
    const items = navItems(3, 2);
    expect(items.find((item) => item.href === "/submissions")?.count).toBe(3);
    expect(items.find((item) => item.href === "/notifications")?.count).toBe(2);
    expect(items.filter((item) => item.count !== undefined)).toHaveLength(2);
  });

  test("every pill page is active on its own path", () => {
    for (const item of navItems(0, 0)) expect(activeHref(item.href)).toBe(item.href);
  });

  test("the public nav lists how it works, earn, install, and faq", () => {
    expect(MARKETING_PAGES.map((page) => page.href)).toEqual([
      "/how-it-works",
      "/earn",
      "/install",
      "/faq",
    ]);
    for (const page of MARKETING_PAGES) {
      expect(activeHref(page.href, MARKETING_PAGES)).toBe(page.href);
    }
  });
});
