import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { parseHtmlDocument } from "../html-document";
import { loadFixtureDocument } from "../load-fixture";
import { extractRecruitee } from "./recruitee";

const PAGE_URL = new URL("https://acme.recruitee.com/o/staff-software-engineer");

describe("recruitee extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("recruitee.html");
    const fields = extractRecruitee(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://acme.recruitee.com/o/staff-software-engineer/c/new");
    expect(job).toMatchObject({
      board: "recruitee",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://acme.recruitee.com/o/staff-software-engineer/c/new",
    });
  });

  test("uses the logo alt text when the company node is missing", () => {
    const root = parseHtmlDocument(`
      <img class="company-logo" alt="Acme Labs" />
      <h1 class="custom-css-style-job-title">Role</h1>
    `);
    expect(extractRecruitee(root, PAGE_URL).company).toBe("Acme Labs");
  });

  test("does not extract a job from the listing fixture", () => {
    const root = loadFixtureDocument("recruitee-no-job.html");
    expect(extractRecruitee(root, PAGE_URL).title).toBe("");
    expect(captureJob(root, PAGE_URL.href)).toBeNull();
  });
});
