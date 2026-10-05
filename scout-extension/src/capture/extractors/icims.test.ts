import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractIcims } from "./icims";

const PAGE_URL = new URL("https://careers-acme.icims.com/jobs/123/job");

describe("icims extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("icims.html");
    const fields = extractIcims(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://careers-acme.icims.com/jobs/123/job?mode=apply");
    expect(job).toMatchObject({
      board: "icims",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://careers-acme.icims.com/jobs/123/job?mode=apply",
    });
  });

  test("does not extract a job from the listing fixture", () => {
    const root = loadFixtureDocument("icims-no-job.html");
    expect(extractIcims(root, PAGE_URL).title).toBe("");
    expect(captureJob(root, PAGE_URL.href)).toBeNull();
  });
});
