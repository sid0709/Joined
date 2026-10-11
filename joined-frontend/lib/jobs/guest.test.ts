import { describe, expect, it } from "bun:test";
import { GUEST_FILTERS, isGuestView, signInToSearch } from "./guest";

describe("isGuestView", () => {
  it("is the first page of the newest jobs", () => {
    expect(isGuestView(GUEST_FILTERS, 1)).toBe(true);
  });

  it("is nothing else", () => {
    expect(isGuestView(GUEST_FILTERS, 2)).toBe(false);
    expect(isGuestView({ ...GUEST_FILTERS, q: "designer" }, 1)).toBe(false);
    expect(isGuestView({ ...GUEST_FILTERS, sort: "pay" }, 1)).toBe(false);
    expect(isGuestView({ ...GUEST_FILTERS, list: "saved" }, 1)).toBe(false);
    expect(isGuestView({ ...GUEST_FILTERS, visa: true }, 1)).toBe(false);
  });
});

describe("signInToSearch", () => {
  const next = (href: string) => new URL(href, "http://joined.test").searchParams.get("next");

  it("comes back to the search, without the visitor's newest-first sort", () => {
    expect(next(signInToSearch({ ...GUEST_FILTERS, q: "designer", where: "Austin" }, 1))).toBe(
      "/?q=designer&where=Austin",
    );
  });

  it("keeps a sort and page the visitor chose", () => {
    expect(next(signInToSearch({ ...GUEST_FILTERS, sort: "pay" }, 3))).toBe("/?sort=pay&page=3");
  });

  it("comes back to the plain list when nothing was asked", () => {
    expect(next(signInToSearch(GUEST_FILTERS, 1))).toBe("/");
  });
});
