import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractLinkedIn } from "./linkedin";

const PAGE_URL = new URL("https://www.linkedin.com/jobs/view/123");

describe("linkedin extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("linkedin.html");
    const fields = extractLinkedIn(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe(PAGE_URL.href);
    expect(job?.board).toBe("linkedin");
  });
});
