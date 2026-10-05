import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { loadFixtureDocument } from "../load-fixture";
import { extractWorkday } from "./workday";

const PAGE_URL = new URL("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/SF/Title_JR1");

describe("workday extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("workday.html");
    const fields = extractWorkday(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe(PAGE_URL.href);
    expect(job?.board).toBe("workday");
    expect(job?.company).toBe("acme");
  });
});
