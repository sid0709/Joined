import { describe, expect, test } from "bun:test";

import { parseDetail } from "./parseDetail.js";
import { parseJobPostingJsonLd } from "./parseInit.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

const EXTERNAL_URL =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204";
const EASY_URL = "https://builtin.com/job/specialist-account-executive/11617804";

describe("parseDetail", () => {
  test("reads Easy Apply jobs and falls back to the Built In URL when applyUrl is empty", () => {
    const record = parseDetail(loadFixture("detail-easyapply.html"), EASY_URL);
    expect(record.meta.isEasyApply).toBe(true);
    expect(record.meta.isLoggedIn).toBe(false);
    expect(record.meta.applyUrl).toBe("");
    expect(record.applyLink).toBe(EASY_URL);
    expect(record.tags).toContain("Easy Apply");
    expect(record.title).toContain("Specialist Account Executive");
    expect(record.company.name).toBe("Zscaler");
    expect(record.details.salary).toBe("113K-162K Annually");
    expect(record.details.salary).not.toContain("50K");
    expect(record.skills.length).toBeGreaterThan(0);
    expect(record.description).toContain("Short job description");
  });

  test("reads an external job and keeps isEasyApply false", () => {
    const record = parseDetail(loadFixture("detail-external.html"), EXTERNAL_URL);
    expect(record.meta.isEasyApply).toBe(false);
    expect(record.tags).not.toContain("Easy Apply");
    expect(record.applyLink).toBe(EXTERNAL_URL);
    expect(record.title).toContain("Staff/ Principal Engineer");
    expect(record.company.name).toBe("Micron Technology");
    expect(record.company.tags).toEqual([
      "Artificial Intelligence",
      "Hardware",
      "Information Technology",
      "Machine Learning",
    ]);
    expect(record.companyLink).toBe("https://builtin.com/company/micron-technology");
    expect(record.postedAgo).toMatch(/Ago/i);
  });

  test("uses the signed-in applyUrl when jobPostInit provides one", () => {
    const record = parseDetail(loadFixture("detail-signed-in.html"), EXTERNAL_URL);
    expect(record.meta.isLoggedIn).toBe(true);
    expect(record.applyLink).toBe("https://careers.micron.com/apply/9256204");
    expect(record.meta.isEasyApply).toBe(false);
  });

  test("reads escaped JSON-LD and scopes salary to the job header", () => {
    const html = loadFixture("detail-jsonld-escaped.html");
    expect(html).toContain("ld&#x2B;json");
    const posting = parseJobPostingJsonLd(html);
    expect(posting?.title).toContain("Staff/ Principal Engineer");
    expect(posting?.identifier?.value).toBe("9256204");
    const record = parseDetail(html, EXTERNAL_URL);
    expect(record.details.salary).toBe("90K-100K Annually");
    expect(record.details.salary).not.toBe("50K-60K Annually");
    expect(html).toContain("50K-60K Annually");
  });
});
