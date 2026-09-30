import { describe, expect, test } from "bun:test";

import { ROUTES, safeNextPath, signInHref } from "./routes";

describe("routes", () => {
  test("sign-in keeps the page the scout was opening", () => {
    expect(signInHref("/earnings")).toBe("/sign-in?next=%2Fearnings");
    expect(signInHref("/submissions/abc")).toBe("/sign-in?next=%2Fsubmissions%2Fabc");
  });

  test("only same-site paths survive the next parameter", () => {
    expect(safeNextPath("/earnings")).toBe("/earnings");
    expect(safeNextPath(null)).toBe(ROUTES.dashboard);
    expect(safeNextPath(undefined)).toBe(ROUTES.dashboard);
    expect(safeNextPath("")).toBe(ROUTES.dashboard);
    expect(safeNextPath("https://evil.example")).toBe(ROUTES.dashboard);
    expect(safeNextPath("//evil.example")).toBe(ROUTES.dashboard);
  });

  test("a submission link includes its id", () => {
    expect(ROUTES.submission("abc")).toBe("/submissions/abc");
  });
});
