import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractBambooHr } from "./bamboohr";

const PAGE_URL = new URL("https://acme.bamboohr.com/careers/123");

describe("bamboohr extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("bamboohr.html");
    const fields = extractBambooHr(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://acme.bamboohr.com/careers/123/apply");
    expect(job).toMatchObject({
      board: "bamboohr",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      applyUrl: "https://acme.bamboohr.com/careers/123/apply",
    });
  });

  test("does not extract a job from the listing fixture", () => {
    const root = loadFixtureDocument("bamboohr-no-job.html");
    expect(extractBambooHr(root, PAGE_URL).title).toBe("");
    expect(captureJob(root, PAGE_URL.href)).toBeNull();
  });
});
