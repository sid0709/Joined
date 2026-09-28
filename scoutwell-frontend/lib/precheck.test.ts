import { describe, expect, it } from "bun:test";

import { canonicalUrl, precheckUrl } from "./precheck";
import type { Submission } from "./types";

const existing: Pick<Submission, "id" | "canonicalUrl" | "status">[] = [
  {
    id: "job-1",
    canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
    status: "approved",
  },
];

describe("precheck", () => {
  it("canonicalizes tracking parameters and www", () => {
    expect(canonicalUrl("HTTPS://WWW.Acme.com/jobs/42/?utm_source=li#apply")).toBe(
      "https://acme.com/jobs/42",
    );
  });

  it("rejects another job board", () => {
    const result = precheckUrl("https://www.indeed.com/viewjob?jk=abc");
    expect(result.official).toBe(false);
    expect(result.jobBoard).toBe(true);
    expect(result.reason).toBe("not an official source");
  });

  it("accepts a known ATS host", () => {
    const result = precheckUrl("https://boards.greenhouse.io/northwind/jobs/99");
    expect(result.official).toBe(true);
    expect(result.ats).toBe(true);
  });

  it("flags an active duplicate", () => {
    const result = precheckUrl("https://boards.greenhouse.io/acme/jobs/1?src=li", existing);
    expect(result.duplicateOf).toBe("job-1");
  });
});
