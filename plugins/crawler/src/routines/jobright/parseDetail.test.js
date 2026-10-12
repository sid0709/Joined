import { describe, expect, test } from "bun:test";

import { hasCore, jobInfoUrlFrom, parseDetail, parseDetailNeedsFetch } from "./parseDetail.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

const DETAIL_URL = "https://jobright.ai/jobs/info/6acd0fe6e7a1d9333210fcaf";

describe("JobRight parseDetail", () => {
  test("reads job and company metadata from __NEXT_DATA__", () => {
    const record = parseDetail(loadFixture("detail-next-data.html"), DETAIL_URL);
    expect(record.title).toBe("Machine Learning Engineer");
    expect(record.companyName).toBe("TAJ Technologies, Inc.");
    expect(record.applyUrl).toBe("https://www.linkedin.com/jobs/view/4478559186");
    expect(record.originalPostUrl).toContain("linkedin.com/jobs/view/4478559186");
    expect(record.location).toBe("United States");
    expect(record.workMode).toBe("remote");
    expect(record.employmentType).toBe("Full-time");
    expect(record.seniority).toBe("Senior Level");
    expect(record.salary).toBe("");
    expect(record.postedAt).toBe("2026-10-12T16:50:46Z");
    expect(record.applicantCount).toBe(25);
    expect(record.badges).toContain("Early applicant");
    expect(record.industryTags).toContain("Information Technology & Services");
    expect(record.benefits).toEqual([]);
    expect(record.skills).toContain("Machine Learning");
    expect(record.skills.every((skill) => typeof skill === "string")).toBe(true);
    expect(record.description).toContain("Develops and programs integrated software algorithms");
    expect(record.descriptionSections.responsibilities.length).toBeGreaterThan(3);
    expect(record.descriptionSections.qualifications.required.length).toBeGreaterThan(3);
    expect(record.companyLogo).toContain("licdn.com");
    expect(record.companyWebsite).toBe("https://tajtech.com/");
    expect(record.companySize).toBe("51-200 employees");
    expect(record.companyHq).toBe("Eden Prairie, Minnesota, US");
    expect(record.companyFounded).toBe("1987");
    expect(record.companyAbout).toContain("TAJ Technologies");
    expect(record.companySocial.linkedin).toContain("linkedin.com/company");
    expect(JSON.stringify(record)).not.toContain("skillMatchingScores");
    expect(JSON.stringify(record)).not.toContain("personalSocialConnections");
    expect(parseDetailNeedsFetch(loadFixture("detail-next-data.html"))).toBe(false);
    expect(hasCore(record)).toBe(true);
  });

  test("falls back to the DOM when __NEXT_DATA__ has no jobResult", () => {
    const record = parseDetail(
      loadFixture("detail-dom.html"),
      "https://jobright.ai/jobs/recommend",
    );
    expect(record.title).toBe("Staff Engineer");
    expect(record.companyName).toBe("North Labs");
    expect(record.applyUrl).toBe("https://boards.example/apply/99");
    expect(record.workMode).toBe("hybrid");
    expect(record.employmentType).toBe("Full-time");
    expect(record.location).toBe("Austin, TX");
    expect(record.companyWebsite).toBe("https://north.example");
    expect(record.companySocial.linkedin).toContain("linkedin.com/company/north");
    expect(record.companySocial.x).toContain("x.com/north");
    expect(record.companySocial.facebook).toContain("facebook.com/north");
    expect(record.companySocial.github).toContain("github.com/north");
    expect(record.skills).toEqual(expect.arrayContaining(["Go", "Kubernetes"]));
    expect(record.description).toContain("Ship features.");
    expect(
      jobInfoUrlFrom(loadFixture("detail-dom.html"), "https://jobright.ai/jobs/recommend"),
    ).toContain("/jobs/info/abc123");
    expect(jobInfoUrlFrom("<html></html>", DETAIL_URL)).toBe(DETAIL_URL);
    expect(jobInfoUrlFrom("<html></html>", "not-a-url")).toBe("");
  });

  test("keeps salary optional when the board omitted it", () => {
    const html = loadFixture("detail-next-data.html").replace(
      '"benefitsSummaries":[]',
      '"benefitsSummaries":["Health insurance"],"salary":"$180K"',
    );
    const record = parseDetail(html, DETAIL_URL);
    expect(record.salary).toBe("$180K");
    expect(record.benefits).toEqual(["Health insurance"]);
  });
});
