import { describe, expect, test } from "bun:test";

import { loadFixtureDocument } from "./load-fixture";
import {
  companyFromHostPrefix,
  detectJobBoard,
  firstPathSegment,
  hostnameMatches,
  icimsCompanyFromHost,
  jobviteCompanyFromUrl,
  workdayCompanyFromHost,
  workableCompanyFromUrl,
} from "./hosts";

describe("detectJobBoard", () => {
  test("detects hosted greenhouse, lever, ashby, workday, and linkedin job urls", () => {
    expect(detectJobBoard("https://boards.greenhouse.io/acme/jobs/123")).toBe("greenhouse");
    expect(detectJobBoard("https://job-boards.greenhouse.io/acme/jobs/123")).toBe("greenhouse");
    expect(detectJobBoard("https://jobs.lever.co/acme/abc-def")).toBe("lever");
    expect(detectJobBoard("https://jobs.ashbyhq.com/acme/abc-def")).toBe("ashby");
    expect(
      detectJobBoard("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/SF/Title_JR1"),
    ).toBe("workday");
    expect(detectJobBoard("https://www.linkedin.com/jobs/view/123")).toBe("linkedin");
    expect(
      detectJobBoard("https://linkedin.com/jobs/collections/recommended/?currentJobId=9"),
    ).toBe("linkedin");
  });

  test("detects hosted smartrecruiters, icims, workable, bamboohr, jobvite, and recruitee urls", () => {
    expect(detectJobBoard("https://jobs.smartrecruiters.com/Acme/staff-software-engineer")).toBe(
      "smartrecruiters",
    );
    expect(detectJobBoard("https://careers.smartrecruiters.com/Acme/123")).toBe("smartrecruiters");
    expect(detectJobBoard("https://careers-acme.icims.com/jobs/123/job")).toBe("icims");
    expect(detectJobBoard("https://acme.icims.com/jobs/123/job")).toBe("icims");
    expect(detectJobBoard("https://apply.workable.com/acme/j/ABC123/")).toBe("workable");
    expect(detectJobBoard("https://acme.workable.com/j/ABC123")).toBe("workable");
    expect(detectJobBoard("https://acme.bamboohr.com/careers/123")).toBe("bamboohr");
    expect(detectJobBoard("https://acme.bamboohr.com/jobs/view.php?id=123")).toBe("bamboohr");
    expect(detectJobBoard("https://jobs.jobvite.com/acme/job/oABC123")).toBe("jobvite");
    expect(detectJobBoard("https://acme.jobvite.com/job/oABC123")).toBe("jobvite");
    expect(detectJobBoard("https://acme.recruitee.com/o/staff-software-engineer")).toBe(
      "recruitee",
    );
  });

  test("returns unknown for invalid urls and non-job linkedin pages", () => {
    expect(detectJobBoard("not-a-url")).toBe("unknown");
    expect(detectJobBoard("https://www.linkedin.com/feed/")).toBe("unknown");
    expect(detectJobBoard("https://careers.acme.test/jobs/123")).toBe("unknown");
  });

  test("does not treat lookalike or marketing hosts as boards", () => {
    expect(detectJobBoard("https://evilgreenhouse.io/acme/jobs/1")).toBe("unknown");
    expect(detectJobBoard("https://www.smartrecruiters.com/pricing")).toBe("unknown");
    expect(detectJobBoard("https://www.icims.com/")).toBe("unknown");
    expect(detectJobBoard("https://www.workable.com/")).toBe("unknown");
    expect(detectJobBoard("https://app.workable.com/backend")).toBe("unknown");
    expect(detectJobBoard("https://www.bamboohr.com/")).toBe("unknown");
    expect(detectJobBoard("https://acme.bamboohr.com/home")).toBe("unknown");
    expect(detectJobBoard("https://www.jobvite.com/")).toBe("unknown");
    expect(detectJobBoard("https://hire.jobvite.com/dashboard")).toBe("unknown");
    expect(detectJobBoard("https://www.recruitee.com/")).toBe("unknown");
    expect(detectJobBoard("https://app.recruitee.com/dashboard")).toBe("unknown");
  });

  test("detects boards from distinctive DOM when the host is unknown", () => {
    expect(
      detectJobBoard("https://careers.acme.test/role", loadFixtureDocument("smartrecruiters.html")),
    ).toBe("smartrecruiters");
    expect(
      detectJobBoard("https://careers.acme.test/role", loadFixtureDocument("icims.html")),
    ).toBe("icims");
    expect(
      detectJobBoard("https://careers.acme.test/role", loadFixtureDocument("workable.html")),
    ).toBe("workable");
    expect(
      detectJobBoard("https://careers.acme.test/role", loadFixtureDocument("bamboohr.html")),
    ).toBe("bamboohr");
    expect(
      detectJobBoard("https://careers.acme.test/role", loadFixtureDocument("jobvite.html")),
    ).toBe("jobvite");
    expect(
      detectJobBoard("https://careers.acme.test/role", loadFixtureDocument("recruitee.html")),
    ).toBe("recruitee");
  });

  test("does not treat listing pages as a board from DOM alone", () => {
    expect(
      detectJobBoard(
        "https://careers.acme.test/jobs",
        loadFixtureDocument("smartrecruiters-no-job.html"),
      ),
    ).toBe("unknown");
    expect(
      detectJobBoard("https://careers.acme.test/jobs", loadFixtureDocument("icims-no-job.html")),
    ).toBe("unknown");
    expect(
      detectJobBoard("https://careers.acme.test/jobs", loadFixtureDocument("workable-no-job.html")),
    ).toBe("unknown");
    expect(
      detectJobBoard("https://careers.acme.test/jobs", loadFixtureDocument("bamboohr-no-job.html")),
    ).toBe("unknown");
    expect(
      detectJobBoard("https://careers.acme.test/jobs", loadFixtureDocument("jobvite-no-job.html")),
    ).toBe("unknown");
    expect(
      detectJobBoard(
        "https://careers.acme.test/jobs",
        loadFixtureDocument("recruitee-no-job.html"),
      ),
    ).toBe("unknown");
  });
});

describe("hostname helpers", () => {
  test("hostnameMatches requires an exact host or a dotted suffix", () => {
    expect(hostnameMatches("jobs.lever.co", ["jobs.lever.co"])).toBe(true);
    expect(hostnameMatches("www.linkedin.com", ["linkedin.com"])).toBe(true);
    expect(hostnameMatches("notlinkedin.com", ["linkedin.com"])).toBe(false);
  });

  test("firstPathSegment and host prefixes read board tokens", () => {
    expect(firstPathSegment("/acme/jobs/123")).toBe("acme");
    expect(firstPathSegment("/")).toBe("");
    expect(workdayCompanyFromHost("acme.wd5.myworkdayjobs.com")).toBe("acme");
    expect(workdayCompanyFromHost("example.com")).toBe("");
    expect(companyFromHostPrefix("acme.bamboohr.com", "bamboohr.com")).toBe("acme");
    expect(icimsCompanyFromHost("careers-acme.icims.com")).toBe("acme");
    expect(icimsCompanyFromHost("acme-jobs.icims.com")).toBe("acme");
    expect(workableCompanyFromUrl(new URL("https://apply.workable.com/acme/j/ABC123/"))).toBe(
      "acme",
    );
    expect(workableCompanyFromUrl(new URL("https://acme.workable.com/j/ABC123"))).toBe("acme");
    expect(jobviteCompanyFromUrl(new URL("https://jobs.jobvite.com/acme/job/oABC123"))).toBe(
      "acme",
    );
    expect(jobviteCompanyFromUrl(new URL("https://acme.jobvite.com/job/oABC123"))).toBe("acme");
  });
});
