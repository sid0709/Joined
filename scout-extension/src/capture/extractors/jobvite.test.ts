import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { parseHtmlDocument } from "../html-document";
import { loadFixtureDocument } from "../load-fixture";
import { extractJobvite } from "./jobvite";

const PAGE_URL = new URL("https://jobs.jobvite.com/acme/job/oABC123");

describe("jobvite extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("jobvite.html");
    const fields = extractJobvite(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://jobs.jobvite.com/acme/job/oABC123/apply");
    expect(job).toMatchObject({
      board: "jobvite",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://jobs.jobvite.com/acme/job/oABC123/apply",
    });
  });

  test("uses the logo alt text when the company node is missing", () => {
    const root = parseHtmlDocument(`
      <img class="jv-logo" alt="Acme Labs" />
      <h2 class="jv-header-title">Role</h2>
    `);
    expect(extractJobvite(root, PAGE_URL).company).toBe("Acme Labs");
  });

  test("does not extract a job from the listing fixture", () => {
    const root = loadFixtureDocument("jobvite-no-job.html");
    expect(extractJobvite(root, PAGE_URL).title).toBe("");
    expect(captureJob(root, PAGE_URL.href)).toBeNull();
  });
});
