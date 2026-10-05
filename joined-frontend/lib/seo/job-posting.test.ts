import { describe, expect, test } from "bun:test";

import { JOBS } from "@/lib/jobs/data";
import type { Job } from "@/lib/jobs";

import {
  JOB_POSTING_TYPE,
  MONETARY_AMOUNT_TYPE,
  ORGANIZATION_TYPE,
  PLACE_TYPE,
  SCHEMA_CONTEXT,
  TELECOMMUTE_LOCATION,
} from "./constants";
import { datePostedIso, jobPostingJsonLd, serializeJsonLd } from "./job-posting";

const NOW = new Date("2026-10-05T18:00:00.000Z");
const PAGE_URL = "https://joined.test/jobs/product-designer-northwind";
const sample = JOBS[0] as Job;

describe("JobPosting JSON-LD", () => {
  test("builds required JobPosting fields from a catalog job", () => {
    const posting = jobPostingJsonLd(sample, { pageUrl: PAGE_URL, now: NOW });
    expect(posting["@context"]).toBe(SCHEMA_CONTEXT);
    expect(posting["@type"]).toBe(JOB_POSTING_TYPE);
    expect(posting.title).toBe("Product Designer");
    expect(posting.description).toBe(sample.summary);
    expect(posting.datePosted).toBe("2026-10-03T20:00:00.000Z");
    expect(posting.url).toBe(PAGE_URL);
    expect(posting.validThrough).toBeUndefined();
    expect(posting.employmentType).toBe("FULL_TIME");
    expect(posting.directApply).toBe(true);
    expect(posting.hiringOrganization).toEqual({
      "@type": ORGANIZATION_TYPE,
      name: "Northwind",
    });
    expect(posting.jobLocation).toEqual({
      "@type": PLACE_TYPE,
      address: { "@type": "PostalAddress", addressLocality: "Chicago, IL" },
    });
    expect(posting.baseSalary).toEqual({
      "@type": MONETARY_AMOUNT_TYPE,
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: 140_000,
        maxValue: 170_000,
        unitText: "YEAR",
      },
    });
    expect(posting.identifier.value).toBe(sample.id);
  });

  test("maps contract, hourly pay, and remote work", () => {
    const remote = JOBS.find((job) => job.id === "brand-designer-fieldnote") as Job;
    const posting = jobPostingJsonLd(remote, { now: NOW });
    expect(posting.employmentType).toBe("CONTRACTOR");
    expect(posting.jobLocationType).toBe(TELECOMMUTE_LOCATION);
    expect(posting.directApply).toBe(false);
    expect(posting.baseSalary?.value.unitText).toBe("HOUR");
    expect(posting.baseSalary?.value.minValue).toBe(80);
    expect(posting.url).toBeUndefined();
  });

  test("maps part-time employment and omits empty pay", () => {
    const partTime = {
      ...(JOBS.find((job) => job.id === "part-time-copywriter-fieldnote") as Job),
      pay: { min: 0, max: 0, currency: "USD", period: "hour" as const },
    };
    const posting = jobPostingJsonLd(partTime, { now: NOW });
    expect(posting.employmentType).toBe("PART_TIME");
    expect(posting.baseSalary).toBeUndefined();
  });

  test("includes validThrough, company URL, and logo when present", () => {
    const withOrg: Job = {
      ...sample,
      companyUrl: "northwind.example",
      companyLogo: "https://cdn.example/northwind.png",
    };
    const posting = jobPostingJsonLd(withOrg, {
      pageUrl: PAGE_URL,
      now: NOW,
      validThrough: "2026-12-31T00:00:00.000Z",
    });
    expect(posting.validThrough).toBe("2026-12-31T00:00:00.000Z");
    expect(posting.hiringOrganization.sameAs).toBe("https://northwind.example");
    expect(posting.hiringOrganization.logo).toBe("https://cdn.example/northwind.png");
  });

  test("resolves a same-origin logo path against the job URL", () => {
    const posting = jobPostingJsonLd(
      { ...sample, companyLogo: "/companies/northwind/logo" },
      { pageUrl: PAGE_URL, now: NOW },
    );
    expect(posting.hiringOrganization.logo).toBe("https://joined.test/companies/northwind/logo");
  });

  test("falls back to the title when the summary is empty", () => {
    const posting = jobPostingJsonLd({ ...sample, summary: " " }, { now: NOW });
    expect(posting.description).toBe("Product Designer");
  });

  test("datePosted uses postedHoursAgo from now", () => {
    expect(datePostedIso(2, NOW)).toBe("2026-10-05T16:00:00.000Z");
    expect(datePostedIso(-3, NOW)).toBe(NOW.toISOString());
  });

  test("serializeJsonLd escapes script breakers", () => {
    expect(serializeJsonLd({ title: "A </script> role" })).toBe(
      '{"title":"A \\u003c/script> role"}',
    );
  });

  test("uses workplace when location is blank and skips a relative logo without a page URL", () => {
    const posting = jobPostingJsonLd(
      {
        ...sample,
        location: " ",
        companyLogo: "/companies/northwind/logo",
        companyUrl: "  ",
      },
      { now: NOW },
    );
    expect(posting.jobLocation.address.addressLocality).toBe("hybrid");
    expect(posting.hiringOrganization.logo).toBeUndefined();
    expect(posting.hiringOrganization.sameAs).toBeUndefined();
  });

  test("reads company profile URL and logo, and keeps a max-only salary", () => {
    const posting = jobPostingJsonLd(
      {
        ...sample,
        companyUrl: undefined,
        companyLogo: undefined,
        companyProfile: {
          id: "northwind",
          name: "Northwind",
          url: "https://northwind.example",
          logo: "https://cdn.example/from-profile.png",
        },
        pay: { min: 0, max: 170_000, currency: "USD", period: "year" },
      },
      { now: NOW },
    );
    expect(posting.hiringOrganization.sameAs).toBe("https://northwind.example");
    expect(posting.hiringOrganization.logo).toBe("https://cdn.example/from-profile.png");
    expect(posting.baseSalary?.value.minValue).toBeUndefined();
    expect(posting.baseSalary?.value.maxValue).toBe(170_000);
  });

  test("keeps an already-absolute company URL and a min-only salary", () => {
    const posting = jobPostingJsonLd(
      {
        ...sample,
        companyUrl: "https://careers.northwind.example",
        pay: { min: 140_000, max: 0, currency: "USD", period: "year" },
      },
      { now: NOW },
    );
    expect(posting.hiringOrganization.sameAs).toBe("https://careers.northwind.example");
    expect(posting.baseSalary?.value.minValue).toBe(140_000);
    expect(posting.baseSalary?.value.maxValue).toBeUndefined();
  });
});
