import { describe, expect, test } from "bun:test";

import {
  boardCompanyFallback,
  captureJob,
  mergeExtractedFields,
  parseCapturedJob,
  parseCapturedJobResponse,
  toCapturedJob,
} from "./capture";
import { parseHtmlDocument } from "./html-document";
import { loadFixtureDocument } from "./load-fixture";

describe("captureJob", () => {
  test("fills missing board fields from json-ld", () => {
    const root = parseHtmlDocument(`
      <h1 class="app-title">Role from DOM</h1>
      <script type="application/ld+json">
        {"@type":"JobPosting","title":"Ignored","hiringOrganization":{"name":"Acme"},"jobLocation":"Remote","url":"https://boards.greenhouse.io/acme/jobs/9","description":"From JSON-LD"}
      </script>
    `);
    const job = captureJob(root, "https://boards.greenhouse.io/acme/jobs/9");
    expect(job).toEqual({
      board: "greenhouse",
      title: "Role from DOM",
      company: "Acme",
      location: "Remote",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/9",
      description: "From JSON-LD",
    });
  });

  test("uses json-ld on unknown hosts and rejects pages without a title", () => {
    const jsonld = loadFixtureDocument("jsonld.html");
    const none = loadFixtureDocument("no-job.html");
    expect(
      captureJob(jsonld, "https://careers.acme.test/jobs/staff-software-engineer"),
    ).toMatchObject({
      board: "unknown",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://careers.acme.test/jobs/staff-software-engineer",
      description: "Build the platform.",
    });
    expect(captureJob(none, "https://blog.acme.test/shipping")).toBeNull();
    expect(captureJob(none, "not-a-url")).toBeNull();
  });
});

describe("captured job helpers", () => {
  test("merge, convert, and parse captured jobs", () => {
    expect(mergeExtractedFields({ title: "A" }, { title: "B", company: "C" })).toEqual({
      title: "A",
      company: "C",
      location: undefined,
      applyUrl: undefined,
      description: undefined,
    });
    expect(toCapturedJob("unknown", {}, "https://example.test")).toBeNull();
    expect(toCapturedJob("linkedin", { title: " Role " }, "https://example.test/job")).toEqual({
      board: "linkedin",
      title: "Role",
      company: "",
      location: "",
      applyUrl: "https://example.test/job",
      description: "",
    });
    expect(parseCapturedJob(null)).toBeNull();
    expect(parseCapturedJob({ board: "nope", title: "Role" })).toBeNull();
    expect(parseCapturedJob({ board: "ashby", title: "  " })).toBeNull();
    expect(parseCapturedJob({ board: "ashby", title: "Role" })).toBeNull();
    const valid = {
      board: "ashby" as const,
      title: "Role",
      company: "Acme",
      location: "Remote",
      applyUrl: "https://jobs.ashbyhq.com/acme/1",
      description: "Do work",
    };
    expect(parseCapturedJob(valid)).toEqual(valid);
    expect(parseCapturedJobResponse({ job: valid })).toEqual(valid);
    expect(parseCapturedJobResponse({ job: null })).toBeNull();
    expect(parseCapturedJobResponse("nope")).toBeNull();
    expect(
      boardCompanyFallback("greenhouse", new URL("https://boards.greenhouse.io/acme/jobs/1")),
    ).toBe("acme");
    expect(
      boardCompanyFallback("workday", new URL("https://acme.wd1.myworkdayjobs.com/job/1")),
    ).toBe("acme");
    expect(boardCompanyFallback("linkedin", new URL("https://www.linkedin.com/jobs/view/1"))).toBe(
      "",
    );
  });
});
