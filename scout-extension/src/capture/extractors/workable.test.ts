import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractWorkable } from "./workable";

const PAGE_URL = new URL("https://apply.workable.com/acme/j/ABC123/");

describe("workable extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("workable.html");
    const fields = extractWorkable(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://apply.workable.com/acme/j/ABC123/apply");
    expect(job).toMatchObject({
      board: "workable",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://apply.workable.com/acme/j/ABC123/apply",
    });
  });

  test("does not extract a job from the listing fixture", () => {
    const root = loadFixtureDocument("workable-no-job.html");
    expect(extractWorkable(root, PAGE_URL).title).toBe("");
    expect(captureJob(root, PAGE_URL.href)).toBeNull();
  });
});
