import { describe, expect, test } from "bun:test";
import { directoryParams, LINK_PARAM } from "./directory";
import { isOpenableLink, searchJobPatchFrom, type SearchRecord } from "./search-job";

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

describe("searchJobPatchFrom", () => {
  test("copies the editable fields and the apply link", () => {
    const record = {
      applyLink: "https://jobs.example.com/apply/1",
      job: {
        title: "Engineer",
        company: "Acme",
        location: "Remote",
        workplace: "remote",
        pay: { min: 0, max: 0, currency: "USD", period: "year" },
        seniority: "mid",
        employment: "full_time",
        visa: false,
        team: "Payments",
        skills: ["Go"],
        summary: "Builds payments.",
        responsibilities: ["Ship"],
        requirements: ["Go"],
        benefits: [],
      },
    } as unknown as SearchRecord;
    const patch = searchJobPatchFrom(record);
    expect(patch.applyLink).toBe(record.applyLink);
    expect(patch.title).toBe("Engineer");
    expect(patch.skills).toEqual(["Go"]);
  });
});
