import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractGreenhouse } from "./greenhouse";

const PAGE_URL = new URL("https://boards.greenhouse.io/acme/jobs/123");

describe("greenhouse extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("greenhouse.html");
    const fields = extractGreenhouse(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe("https://boards.greenhouse.io/acme/jobs/123#app");
    expect(job).toMatchObject({
      board: "greenhouse",
      title: "Staff Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
    });
  });

  test("leaves company empty when the board page has no company node", () => {
    const root = loadFixtureDocument("no-job.html");
    expect(extractGreenhouse(root, PAGE_URL).company).toBe("");
  });
});
