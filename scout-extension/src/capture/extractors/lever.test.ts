import { describe, expect, test } from "bun:test";

import { captureJob } from "../capture";
import { parseHtmlDocument } from "../html-document";
import { loadFixtureDocument } from "../load-fixture";
import { extractLever } from "./lever";

const PAGE_URL = new URL("https://jobs.lever.co/acme/abc-def");

describe("lever extractor", () => {
  test("reads title, company, location, apply url, and description from the fixture", () => {
    const root = loadFixtureDocument("lever.html");
    const fields = extractLever(root, PAGE_URL);
    const job = captureJob(root, PAGE_URL.href);

    expect(fields.title).toBe("Staff Software Engineer");
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("San Francisco, CA");
    expect(fields.description).toBe("Build the platform.");
    expect(fields.applyUrl).toBe(PAGE_URL.href);
    expect(job?.board).toBe("lever");
  });

  test("uses the logo alt text when the company link is missing", () => {
    const root = parseHtmlDocument(`
      <img class="main-header-logo" alt="Acme Labs" />
      <h2 class="posting-name">Role</h2>
    `);
    expect(extractLever(root, PAGE_URL).company).toBe("Acme Labs");
  });
});
