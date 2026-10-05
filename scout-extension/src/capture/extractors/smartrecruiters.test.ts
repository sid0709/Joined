import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractSmartRecruiters } from "./smartrecruiters";

const PAGE_URL = new URL("https://jobs.smartrecruiters.com/Acme/staff-software-engineer");

describe("smartrecruiters extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("smartrecruiters.html");
    const fields = extractSmartRecruiters(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://jobs.smartrecruiters.com/Acme/apply");
    expect(job).toMatchObject({
      board: "smartrecruiters",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://jobs.smartrecruiters.com/Acme/apply",
    });
  });

  test("does not extract a job from the listing fixture", () => {
    const root = loadFixtureDocument("smartrecruiters-no-job.html");
    expect(extractSmartRecruiters(root, PAGE_URL).title).toBe("");
    expect(captureJob(root, PAGE_URL.href)).toBeNull();
  });
});
