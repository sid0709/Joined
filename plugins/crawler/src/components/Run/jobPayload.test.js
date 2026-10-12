import { describe, expect, test } from "bun:test";

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
});
