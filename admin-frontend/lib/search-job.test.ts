import { describe, expect, test } from "bun:test";
import { directoryParams, LINK_PARAM } from "./directory";
import { isOpenableLink } from "./search-job";

describe("isOpenableLink", () => {
  test("opens web addresses only", () => {
    expect(isOpenableLink("https://jobs.example.com/apply/1")).toBe(true);
    expect(isOpenableLink(" http://jobs.example.com ")).toBe(true);
    expect(isOpenableLink("javascript:alert(1)")).toBe(false);
    expect(isOpenableLink("")).toBe(false);
    expect(isOpenableLink(undefined)).toBe(false);
  });
});

describe("directoryParams", () => {
  test("sends the link search to the API", () => {
    const current = new URLSearchParams({ [LINK_PARAM]: "greenhouse.io" });
    expect(directoryParams(current, [], 1, 25).get("link")).toBe("greenhouse.io");
  });
});
