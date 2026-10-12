import { describe, expect, test } from "bun:test";

import { isJobFieldValid } from "../../api/jobValidation.js";
import { parseDetail } from "../../routines/builtin/parseDetail.js";
import "../../routines/builtin/testing/domParser.js";
import { loadFixture } from "../../routines/builtin/testing/loadFixture.js";
import { parseDetail as parseHiringCafeDetail } from "../../routines/hiringcafe/parseDetail.js";
import { detailPageHtml } from "../../routines/hiringcafe/testing/pageHtml.js";
import BuiltInRoutine from "../../routines/BuiltInRoutine.js";
import JobRightRoutine from "../../routines/JobRightRoutine.js";

import { toJobPayload } from "./jobPayload.js";

describe("toJobPayload", () => {
  test("sends applyLink, company.name, details, and extra metadata", () => {
    const payload = toJobPayload(
      {
        applyUrl: "https://jobs.example/apply/1",
        title: "Engineer",
        description: "Build.",
        companyName: "Acme",
        companyLogo: "https://cdn.example/logo.png",
        companyWebsite: "https://acme.com",
        companySize: "51-200",
        companyHq: "Austin",
        location: "Remote",
        workMode: "remote",
        employmentType: "full-time",
        seniority: "Senior",
        salary: "$150K",
        badges: ["Early applicant"],
        applicantCount: 12,
        meta: { id: "skip" },
      },
      JobRightRoutine,
    );
    expect(payload.applyLink).toBe("https://jobs.example/apply/1");
    expect(payload.company).toEqual({
      name: "Acme",
      logo: "https://cdn.example/logo.png",
      website: "https://acme.com",
      size: "51-200",
      hq: "Austin",
    });
    expect(payload.details).toEqual({
      location: "Remote",
      remote: "remote",
      time: "full-time",
      seniority: "Senior",
      salary: "$150K",
    });
    expect(payload.metadata.workMode).toBe("remote");
    expect(payload.metadata.location).toBe("Remote");
    expect(payload.metadata.meta).toBeUndefined();
    expect(payload.tags).toEqual(["Early applicant"]);
    expect(payload.applicants).toEqual({ count: 12 });
    expect(payload.source).toBe("jobright");
    expect(payload.title).toBe("Engineer");
  });

  test("keeps the Built In profile off companyLink and sends socials plus crawl time", () => {
    const payload = toJobPayload(
      {
        applyUrl: "https://builtin.com/job/role/1",
        title: "Engineer",
        description: "Build.",
        companyName: "Micron Technology",
        companyLogo: "https://cdn.example/micron.png",
        companyWebsite: "",
        companyProfileUrl: "https://builtin.com/company/micron-technology",
        companySocials: { linkedin: "https://linkedin.com/company/micron" },
        postedAt: "2026-10-12T17:59:12.000Z",
        postedAgo: "Reposted 48 Seconds Ago",
        postedAtSource: "jsonld+ago",
        crawledAt: "2026-10-12T18:00:00.000Z",
      },
      { id: "builtin" },
    );
    expect(payload.companyLink).toBe("");
    expect(payload.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(payload.company).toEqual({
      name: "Micron Technology",
      logo: "https://cdn.example/micron.png",
      profileUrl: "https://builtin.com/company/micron-technology",
      socials: { linkedin: "https://linkedin.com/company/micron" },
    });
    expect(payload.postedAt).toBe("2026-10-12T17:59:12.000Z");
    expect(payload.postedAgo).toBe("Reposted 48 Seconds Ago");
    expect(payload.metadata.postedAtSource).toBe("jsonld+ago");
    expect(payload.metadata.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(payload.metadata.companyProfileUrl).toBe(
      "https://builtin.com/company/micron-technology",
    );
    expect(payload.metadata.companySocials).toEqual({
      linkedin: "https://linkedin.com/company/micron",
    });
  });

  test("prefers the company website over the Built In profile for companyLink", () => {
    const payload = toJobPayload(
      {
        applyUrl: "https://builtin.com/job/role/1",
        title: "Engineer",
        description: "Build.",
        companyName: "North",
        companyWebsite: "https://north.example/",
        companyProfileUrl: "https://builtin.com/company/north",
      },
      { id: "builtin" },
    );
    expect(payload.companyLink).toBe("https://north.example/");
    expect(payload.company.website).toBe("https://north.example/");
    expect(payload.company.profileUrl).toBe("https://builtin.com/company/north");
  });

  test("Built In fixture website and socials match the field checker", () => {
    const record = parseDetail(
      loadFixture("detail-external.html"),
      "https://builtin.com/job/staff-principal-engineer-oct-mte-material-engineering/9256204",
      { now: new Date("2026-10-12T18:00:00.000Z") },
    );
    const payload = toJobPayload(record, BuiltInRoutine);
    expect(payload.companyLink).toBe("https://www.micron.com/");
    expect(payload.company.website).toBe("https://www.micron.com/");
    expect(payload.company.profileUrl).toBe("https://builtin.com/company/micron-technology");
    expect(payload.company.socials).toEqual({
      linkedin: "https://www.linkedin.com/company/micron-technology",
      x: "https://x.com/MicronTech",
    });
    expect(payload.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(payload.metadata.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(isJobFieldValid(payload, "companyWebsite", BuiltInRoutine)).toBe(true);
    expect(isJobFieldValid(payload, "companySocials", BuiltInRoutine)).toBe(true);
    expect(isJobFieldValid(payload, "applyUrl", BuiltInRoutine)).toBe(true);
    expect(isJobFieldValid(payload, "companyName", BuiltInRoutine)).toBe(true);
  });

  test("lifts apply_url from metadata onto applyLink", () => {
    const payload = toJobPayload(
      {
        title: "Engineer",
        description: "Build.",
        companyName: "Acme",
        metadata: { apply_url: "https://boards.example/apply/9" },
      },
      { id: "hiringcafe" },
    );
    expect(payload.applyLink).toBe("https://boards.example/apply/9");
    expect(isJobFieldValid(payload, "applyUrl", BuiltInRoutine)).toBe(true);
  });

  test("HiringCafe parseDetail keeps crawledAt on the payload and metadata", () => {
    const record = parseHiringCafeDetail(
      detailPageHtml(),
      "https://hiringcafe.com/job/help-desk-coordinator-shell-mobility-and-convenience-usa-houston-texas-uplqcnmhu405bzud",
      { now: new Date("2026-10-12T18:00:00.000Z") },
    );
    const payload = toJobPayload(record, { id: "hiringcafe" });
    expect(record.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(record.metadata.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(payload.crawledAt).toBe("2026-10-12T18:00:00.000Z");
    expect(payload.metadata.crawledAt).toBe("2026-10-12T18:00:00.000Z");
  });
});
