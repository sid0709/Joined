import { describe, expect, test } from "bun:test";

import { companyNameOf, parseDetail, requiredRecordIssues } from "./parseDetail.js";
import { parseJobPostingJsonLd } from "./parseInit.js";
import { POSTED_AT_SOURCE } from "./postedAgo.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

const EXTERNAL_URL =
  "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204";
const EASY_URL = "https://builtin.com/job/specialist-account-executive/11617804";
const HPE_URL = "https://builtin.com/job/software-development-engineer-test/11623103";
const CRAWL_NOW = new Date("2026-10-12T18:00:00.000Z");

function parse(html, pageUrl, extra = {}) {
  return parseDetail(html, pageUrl, { now: CRAWL_NOW, ...extra });
}

describe("parseDetail", () => {
  test("reads Easy Apply jobs and falls back to the Built In URL when applyUrl is empty", () => {
    const record = parse(loadFixture("detail-easyapply.html"), EASY_URL);
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
    expect(record.companyWebsite).toBe("https://www.zscaler.com/");
    expect(record.companyProfileUrl).toBe("https://builtin.com/company/zscaler");
    expect(record.companySocials).toEqual({
      linkedin: "https://www.linkedin.com/company/zscaler",
      x: "https://x.com/zscaler",
    });
    expect(record.companyHq).toBe("San Jose, CA");
    expect(record.postedAgo).toBe("Posted 5 Minutes Ago");
    expect(record.postedAt).toBe("2026-10-12T17:55:00.000Z");
    expect(record.postedAtSource).toBe(POSTED_AT_SOURCE.JSONLD_AGO);
    expect(record.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(record.description).toContain("Short job description");
  });

  test("reads an external job and keeps isEasyApply false", () => {
    const record = parse(loadFixture("detail-external.html"), EXTERNAL_URL);
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
    expect(record.companyWebsite).toBe("https://www.micron.com/");
    expect(record.companyProfileUrl).toBe("https://builtin.com/company/micron-technology");
    expect(record.companySocials).toEqual({
      linkedin: "https://www.linkedin.com/company/micron-technology",
      x: "https://x.com/MicronTech",
    });
    expect(record.companyHq).toBe("Boise, ID");
    expect(record.postedAgo).toBe("Reposted 48 Seconds Ago");
    expect(record.postedAt).toBe("2026-10-12T17:59:12.000Z");
    expect(record.postedAtSource).toBe(POSTED_AT_SOURCE.JSONLD_AGO);
    expect(record.crawledAt).toBe("2026-10-12T18:00:00.000Z");
  });

  test("uses the signed-in applyUrl when jobPostInit provides one", () => {
    const record = parse(loadFixture("detail-signed-in.html"), EXTERNAL_URL);
    expect(record.meta.isSignedIn).toBe(true);
    expect(record.applyUrl).toBe("https://careers.micron.com/apply/9256204");
    expect(record.meta.isEasyApply).toBe(false);
  });

  test("resolves a relative ApplyRedirect path to an absolute builtin.com URL", () => {
    const record = parse(loadFixture("detail-apply-redirect.html"), EXTERNAL_URL);
    expect(record.applyUrl).toBe(`${EXTERNAL_URL}?handler=ApplyRedirect`);
    expect(record.meta.applyUrl).toBe("?handler=ApplyRedirect");
  });

  test("prefers jobPostInit companyName, then JSON-LD org.name, then the first company link with text", () => {
    const page = "https://builtin.com/job/eng-quality/11621046";
    const initFirst = parse(
      `<h1>Quality Engineer</h1>
       <a href="/company/logo"></a>
       <a href="/company/dom-co">From DOM</a>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"11621046"},"hiringOrganization":{"@type":"Organization","name":"From JSON-LD"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":11621046,"companyName":"From Init","title":"Quality Engineer","applyUrl":"/job/eng-quality/11621046?handler=ApplyRedirect","isEasyApply":false,"isSaved":false}});</script>`,
      page,
    );
    expect(initFirst.companyName).toBe("From Init");
    expect(initFirst.meta.isLoggedIn).toBeUndefined();
    expect(typeof initFirst.companyName).toBe("string");
    expect(initFirst.applyUrl).toBe(
      "https://builtin.com/job/eng-quality/11621046?handler=ApplyRedirect",
    );

    const ldNext = parse(
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

    const domLast = parse(
      `<h1>Quality Engineer</h1>
       <a href="/company/logo"></a>
       <a href="/company/dom-co">From DOM</a>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"},"hiringOrganization":{"@type":"Organization"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"title":"Quality Engineer","applyUrl":"","isEasyApply":true,"isSaved":false}});</script>`,
      page,
    );
    expect(domLast.companyName).toBe("From DOM");

    const fromCard = parse(
      `<h1>Quality Engineer</h1>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"title":"Quality Engineer","applyUrl":"","isEasyApply":true,"isSaved":false},"isLoggedIn":true});</script>`,
      page,
      { companyName: "From List Card" },
    );
    expect(fromCard.companyName).toBe("From List Card");
  });

  test("resolves a relative HPE applyUrl and reads Hewlett Packard Enterprise", () => {
    const record = parse(loadFixture("detail-hpe.html"), HPE_URL);
    expect(record.meta.isEasyApply).toBe(false);
    expect(record.meta.applyUrl).toBe("/job/software-development-engineer-test/11623103");
    expect(record.applyUrl).toBe(HPE_URL);
    expect(record.applyUrl.startsWith("https://")).toBe(true);
    expect(record.companyName).toBe("Hewlett Packard Enterprise");
    expect(record.title).toContain("Software Development Engineer in Test");
    expect(record.meta.isLoggedIn).toBe(true);
    expect(record.companyProfileUrl).toBe("https://builtin.com/company/hewlett-packard-enterprise");
    expect(record.companyWebsite).toBe("");
    expect(record.postedAgo).toBe("");
    expect(record.postedAt).toBe("2026-10-12T00:00:00.000Z");
    expect(record.postedAtSource).toBe(POSTED_AT_SOURCE.JSONLD);
    expect(record.crawledAt).toBe("2026-10-12T18:00:00.000Z");
  });

  test("normalizes companyName to a string or null, never [object Object]", () => {
    expect(companyNameOf({ name: "Clearwater Analytics (CWAN)" })).toBe(
      "Clearwater Analytics (CWAN)",
    );
    expect(companyNameOf({ id: 9, slug: "acme" })).toBeNull();
    expect(companyNameOf("[object Object]")).toBeNull();
    expect(companyNameOf("  ")).toBeNull();

    const page = "https://builtin.com/job/eng-quality/11621046";
    const fromName = parse(
      `<h1>Quality Engineer</h1>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"companyName":{"name":"From Object"},"title":"Quality Engineer","applyUrl":"","isEasyApply":false,"isSaved":false}});</script>`,
      page,
    );
    expect(fromName.companyName).toBe("From Object");
    expect(typeof fromName.companyName).toBe("string");
    expect(fromName.companyName).not.toBe("[object Object]");

    const empty = parse(
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
    const record = parse(html, EXTERNAL_URL);
    expect(record.salary).toBe("90K-100K Annually");
    expect(record.salary).not.toBe("50K-60K Annually");
    expect(html).toContain("50K-60K Annually");
    expect(record.companyProfileUrl).toBe("https://builtin.com/company/micron-technology");
  });

  test("prefers a timed JSON-LD datePosted and reads website plus socials from the job page", () => {
    const page = "https://builtin.com/job/eng-quality/11621046";
    const record = parse(
      `<h1>Quality Engineer</h1>
       <a href="/company/north">North</a>
       <a href="https://linkedin.com/company/north">LinkedIn</a>
       <a href="https://x.com/north">X</a>
       <div class="job-post-item"><div class="match-background">
         <i class="fa-light fa-clock"></i>
         <div class="gap-sm"><span>Posted 12 Days Ago</span></div>
       </div></div>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"},"datePosted":"2026-10-01T14:30:00Z","hiringOrganization":{"@type":"Organization","name":"North","url":"https://north.example/","sameAs":"https://builtin.com/company/north"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"companyName":"North","title":"Quality Engineer","applyUrl":"","isEasyApply":true,"isSaved":false}});</script>`,
      page,
    );
    expect(record.postedAgo).toBe("Posted 12 Days Ago");
    expect(record.postedAt).toBe("2026-10-01T14:30:00.000Z");
    expect(record.postedAtSource).toBe(POSTED_AT_SOURCE.JSONLD);
    expect(record.companyWebsite).toBe("https://north.example/");
    expect(record.companyProfileUrl).toBe("https://builtin.com/company/north");
    expect(record.companySocials).toEqual({
      linkedin: "https://linkedin.com/company/north",
      x: "https://x.com/north",
    });
    expect(record.crawledAt).toBe("2026-10-12T18:00:00.000Z");
  });

  test("leaves website and socials empty when the live Company box omits them", () => {
    const page = "https://builtin.com/job/talent-acquisition-specialist-corporate/11623794";
    const record = parse(
      `<h1>Talent Acquisition Specialist - Corporate</h1>
       <a href="/company/echostar">EchoStar</a>
       <div class="bg-midnight text-white">The Company</div>
       <div class="bg-white rounded-3 mb-sm p-md">
         <div class="d-flex align-items-start gap-sm">
           <i class="fa-regular fa-map-location-dot"></i>
           <div class="font-barlow text-gray-03">HQ:  Englewood, CO</div>
         </div>
         <div class="d-flex align-items-start gap-sm">
           <i class="fa-regular fa-user-group"></i>
           <span class="font-barlow text-gray-03">14,500 Employees</span>
         </div>
         <div class="d-flex align-items-start gap-sm">
           <i class="fa-regular fa-calendar"></i>
           <span class="font-barlow text-gray-03">Year Founded: 1980</span>
         </div>
       </div>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Talent Acquisition Specialist - Corporate","description":"Hire.","identifier":{"value":"11623794"},"datePosted":"2026-10-12","hiringOrganization":{"@type":"Organization","name":"EchoStar","sameAs":"https://builtin.com/company/echostar"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":11623794,"companyName":"EchoStar","title":"Talent Acquisition Specialist - Corporate","applyUrl":"","isEasyApply":false,"isSaved":false}});</script>`,
      page,
    );
    expect(record.companyName).toBe("EchoStar");
    expect(record.companyProfileUrl).toBe("https://builtin.com/company/echostar");
    expect(record.companyHq).toBe("Englewood, CO");
    expect(record.companySize).toBe("14,500 Employees");
    expect(record.companyFounded).toBe("1980");
    expect(record.companyWebsite).toBe("");
    expect(record.companySocials).toEqual({});
  });

  test("resolves postedAt from relative text when JSON-LD has no datePosted", () => {
    const page = "https://builtin.com/job/eng-quality/11621046";
    const record = parse(
      `<h1>Quality Engineer</h1>
       <div class="job-post-item"><div class="match-background">
         <i class="fa-light fa-clock"></i>
         <div class="gap-sm"><span>Posted 12 Days Ago</span></div>
       </div></div>
       <script type="application/ld+json">{"@type":"JobPosting","title":"Quality Engineer","description":"D","identifier":{"value":"1"}}</script>
       <script>Builtin.jobPostInit({"job":{"id":1,"companyName":"North","title":"Quality Engineer","applyUrl":"","isEasyApply":true,"isSaved":false}});</script>`,
      page,
    );
    expect(record.postedAgo).toBe("Posted 12 Days Ago");
    expect(record.postedAt).toBe("2026-09-30T18:00:00.000Z");
    expect(record.postedAtSource).toBe(POSTED_AT_SOURCE.AGO);
  });

  test("lists missing core fields without treating them as a page block", () => {
    expect(requiredRecordIssues({})).toEqual(["applyUrl", "companyName", "title", "description"]);
    expect(
      requiredRecordIssues({
        applyUrl: HPE_URL,
        companyName: "Hewlett Packard Enterprise",
        title: "SDET",
        description: "Role",
      }),
    ).toEqual([]);
  });
});
