import { describe, expect, test } from "bun:test";

import { companyNameOf, parseDetail } from "./parseDetail.js";
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

  test("prefers jobPostInit companyName, then JSON-LD org.name, then the first company link with text", () => {
    const page = "https://builtin.com/job/eng-quality/11621046";
    const initFirst = parseDetail(
      `<h1>Quality Engineer</h1>
       <a href="/company/logo"></a>
       <a href="/company/dom-co">From DOM</a>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"11621046"},"hiringOrganization":{"@type":"Organization","name":"From JSON-LD"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":11621046,"companyName":"From Init","title":"Quality Engineer","applyUrl":"/job/eng-quality/11621046?handler=ApplyRedirect","isEasyApply":false,"isSaved":false}});</script>`,
      page,
    );
    expect(initFirst.companyName).toBe("From Init");
    expect(typeof initFirst.companyName).toBe("string");
    expect(initFirst.applyUrl).toBe(
      "https://builtin.com/job/eng-quality/11621046?handler=ApplyRedirect",
    );

    const ldNext = parseDetail(
      `<h1>Quality Engineer</h1>
       <a href="/company/logo"></a>
       <a href="/company/dom-co">From DOM</a>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"},"hiringOrganization":{"@type":"Organization","name":"From JSON-LD"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"companyName":"","title":"Quality Engineer","applyUrl":"","isEasyApply":true,"isSaved":false}});</script>`,
      page,
    );
    expect(ldNext.companyName).toBe("From JSON-LD");
    expect(ldNext.applyUrl).toBe(page);
    expect(ldNext.title).toBe("Quality Engineer");

    const domLast = parseDetail(
      `<h1>Quality Engineer</h1>
       <a href="/company/logo"></a>
       <a href="/company/dom-co">From DOM</a>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"},"hiringOrganization":{"@type":"Organization"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"title":"Quality Engineer","applyUrl":"","isEasyApply":true,"isSaved":false}});</script>`,
      page,
    );
    expect(domLast.companyName).toBe("From DOM");
  });

  test("normalizes companyName to a string or null, never [object Object]", () => {
    expect(companyNameOf({ name: "Clearwater Analytics (CWAN)" })).toBe(
      "Clearwater Analytics (CWAN)",
    );
    expect(companyNameOf({ id: 9, slug: "acme" })).toBeNull();
    expect(companyNameOf("[object Object]")).toBeNull();
    expect(companyNameOf("  ")).toBeNull();

    const page = "https://builtin.com/job/eng-quality/11621046";
    const fromName = parseDetail(
      `<h1>Quality Engineer</h1>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"companyName":{"name":"From Object"},"title":"Quality Engineer","applyUrl":"","isEasyApply":false,"isSaved":false}});</script>`,
      page,
    );
    expect(fromName.companyName).toBe("From Object");
    expect(typeof fromName.companyName).toBe("string");
    expect(fromName.companyName).not.toBe("[object Object]");

    const empty = parseDetail(
      `<h1>Quality Engineer</h1>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"},"hiringOrganization":{"@type":"Organization"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"companyName":{"id":1},"title":"Quality Engineer","applyUrl":"","isEasyApply":false,"isSaved":false}});</script>`,
      page,
    );
    expect(empty.companyName).toBeNull();
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
