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
    expect(record.meta.isSignedIn).toBe(false);
    expect(record.meta.applyUrl).toBe("");
    expect(record.applyUrl).toBe(EASY_URL);
    expect(record.badges).toContain("Easy Apply");
    expect(record.title).toContain("Specialist Account Executive");
    expect(record.companyName).toBe("Zscaler");
    expect(record.salary).toBe("113K-162K Annually");
    expect(record.salary).not.toContain("50K");
    expect(record.skills).toBeUndefined();
    expect(record.companyWebsite).toBeUndefined();
    expect(record.description).toContain("Short job description");
  });

  test("reads an external job and keeps isEasyApply false", () => {
    const record = parseDetail(loadFixture("detail-external.html"), EXTERNAL_URL);
    expect(record.meta.isEasyApply).toBe(false);
    expect(record.badges).not.toContain("Easy Apply");
    expect(record.applyUrl).toBe(EXTERNAL_URL);
    expect(record.title).toContain("Staff/ Principal Engineer");
    expect(record.companyName).toBe("Micron Technology");
    expect(record.industryTags).toEqual([
      "Artificial Intelligence",
      "Hardware",
      "Information Technology",
      "Machine Learning",
    ]);
    expect(record.companyWebsite).toBeUndefined();
    expect(record.postedAt).toMatch(/2026-10-12/);
  });

  test("uses the signed-in applyUrl when jobPostInit provides one", () => {
    const record = parseDetail(loadFixture("detail-signed-in.html"), EXTERNAL_URL);
    expect(record.meta.isSignedIn).toBe(true);
    expect(record.applyUrl).toBe("https://careers.micron.com/apply/9256204");
    expect(record.meta.isEasyApply).toBe(false);
  });

  test("resolves a relative ApplyRedirect path to an absolute builtin.com URL", () => {
    const record = parseDetail(loadFixture("detail-apply-redirect.html"), EXTERNAL_URL);
    expect(record.applyUrl).toBe(`${EXTERNAL_URL}?handler=ApplyRedirect`);
    expect(record.meta.applyUrl).toBe("?handler=ApplyRedirect");
  });

  test("reads escaped JSON-LD and scopes salary to the job header", () => {
    const html = loadFixture("detail-jsonld-escaped.html");
    expect(html).toContain("ld&#x2B;json");
    const posting = parseJobPostingJsonLd(html);
    expect(posting?.title).toContain("Staff/ Principal Engineer");
    expect(posting?.identifier?.value).toBe("9256204");
    const record = parseDetail(html, EXTERNAL_URL);
    expect(record.salary).toBe("90K-100K Annually");
    expect(record.salary).not.toBe("50K-60K Annually");
    expect(html).toContain("50K-60K Annually");
  });
});
