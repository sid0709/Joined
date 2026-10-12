import { describe, expect, test } from "bun:test";

import { POSTED_AT_SOURCE } from "./constants.js";
import { parseDetail, requiredRecordIssues } from "./parseDetail.js";
import { detailJob, detailPageHtml } from "./testing/pageHtml.js";
import "./testing/domParser.js";
import { salaryFrom, websiteUrl } from "./values.js";

const DETAIL_URL =
  "https://hiringcafe.com/job/help-desk-coordinator-shell-mobility-and-convenience-usa-houston-texas-uplqcnmhu405bzud";

describe("parseDetail fields", () => {
  test("reads required ingest fields and dumps the job JSON into metadata", () => {
    const record = parseDetail(detailPageHtml(), DETAIL_URL);
    expect(record.applyUrl).toBe(
      "https://myjobs.adp.com/shellmobilityandconvenience/cx/job-details?reqId=5001231308500",
    );
    expect(record.title).toBe("Help Desk Coordinator");
    expect(record.description).toContain("Coordinate help desk tickets");
    expect(record.companyName).toBe("Shell Mobility and Convenience USA");
    expect(record.companyWebsite).toBe("https://texaspetroleumgroup.com");
    expect(record.companyProfileUrl).toBeUndefined();
    expect(record.companySocial).toBeUndefined();
    expect(record.postedAt).toBe("2026-10-12T18:03:03.455Z");
    expect(record.postedAgo).toBe("Posted 3h ago");
    expect(record.postedAtSource).toBe(POSTED_AT_SOURCE.ESTIMATED_PUBLISH_DATE);
    expect(record.companyLogo).toContain("googleusercontent.com/s2/favicons");
    expect(record.location).toBe("Austin, Texas, United States");
    expect(record.workMode).toBe("onsite");
    expect(record.employmentType).toBe("Full Time");
    expect(record.skills).toEqual(["Excel", "Outlook"]);
    expect(record.benefits).toContain("401k matching");
    expect(record.salary).toBe("$19.50-$22/hr");
    expect(record.requisitionId).toBe("uplqcnmhu405bzud");
    expect(record.meta.id).toBe("uplqcnmhu405bzud");
    expect(record.metadata.v5_processed_job_data.hourly_min_compensation).toBe(19.5);
    expect(record.metadata.enriched_company_data.external_id).toBe("org123");
    expect(record.metadata.job_information.title).toBe("Help Desk Coordinator");
    expect(record.metadata.jsonLd["@type"]).toBe("JobPosting");
    expect(requiredRecordIssues(record)).toEqual([]);
  });

  test("prefers a non-favicon logo when JSON-LD has one", () => {
    const record = parseDetail(
      detailPageHtml({
        jsonLd: {
          "@type": "JobPosting",
          title: "Help Desk Coordinator",
          description: "Coordinate help desk tickets.",
          hiringOrganization: {
            name: "Shell Mobility and Convenience USA",
            logo: "https://cdn.example/logo.png",
          },
        },
      }),
      DETAIL_URL,
    );
    expect(record.companyLogo).toBe("https://cdn.example/logo.png");
  });

  test("keeps a logo HiringCafe rendered and does not invent a favicon", () => {
    expect(websiteUrl("texaspetroleumgroup.com")).toBe("https://texaspetroleumgroup.com");
    const record = parseDetail(
      detailPageHtml({
        logoSrc: "",
        jsonLd: {
          "@type": "JobPosting",
          title: "Help Desk Coordinator",
          description: "<p>Coordinate help desk tickets and vendor access.</p>",
        },
      }),
      DETAIL_URL,
    );
    expect(record.companyLogo).toBeUndefined();
  });

  test("formats salary from the listed compensation period", () => {
    expect(
      salaryFrom({
        yearly_min_compensation: 100000,
        yearly_max_compensation: 122000,
        listed_compensation_frequency: "Yearly",
      }),
    ).toBe("$100k-$122k/yr");
    expect(salaryFrom({})).toBe("");
  });

  test("flags missing required ingest fields", () => {
    const job = detailJob({
      apply_url: "",
      job_information: { title: "", description: "" },
      v5_processed_job_data: { core_job_title: "", company_name: "" },
    });
    job.enriched_company_data.name = "";
    job.attributed_org.name = "";
    job.v5_processed_job_data.company_name = "";
    const record = parseDetail(
      detailPageHtml({ job, jsonLd: { "@type": "JobPosting" } }),
      DETAIL_URL,
    );
    expect(requiredRecordIssues(record)).toEqual([
      "applyUrl",
      "companyName",
      "title",
      "description",
    ]);
  });
});
