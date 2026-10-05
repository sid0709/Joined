import { describe, expect, test } from "bun:test";

import { JOBS } from "@/lib/jobs/data";
import type { Job } from "@/lib/jobs";

import { FALLBACK_JOB_TITLE } from "./constants";
import {
  absoluteJobPageUrl,
  jobPageDescription,
  jobPageMetadata,
  jobPageTitle,
} from "./job-metadata";

const ORIGIN = "https://joined.test";
const sample = JOBS[0] as Job;

describe("job page metadata", () => {
  test("title includes title, company, and location", () => {
    expect(jobPageTitle(sample)).toBe("Product Designer at Northwind · Chicago, IL");
  });

  test("title omits location when it is blank", () => {
    expect(jobPageTitle({ ...sample, location: "  " })).toBe("Product Designer at Northwind");
  });

  test("description prefers the job summary", () => {
    expect(jobPageDescription(sample)).toBe(sample.summary);
  });

  test("description falls back to title, company, and location", () => {
    expect(jobPageDescription({ ...sample, summary: "  " })).toBe(
      "Product Designer at Northwind in Chicago, IL",
    );
  });

  test("missing jobs are titled and not indexed", () => {
    expect(jobPageMetadata(null)).toEqual({
      title: FALLBACK_JOB_TITLE,
      robots: { index: false, follow: false },
    });
  });

  test("canonical and open graph URLs use the public origin", () => {
    const meta = jobPageMetadata(sample, ORIGIN);
    const url = `${ORIGIN}/jobs/${sample.id}`;
    expect(meta.title).toBe("Product Designer at Northwind · Chicago, IL");
    expect(meta.description).toBe(sample.summary);
    expect(meta.alternates).toEqual({ canonical: url });
    expect(meta.openGraph).toEqual({
      title: "Product Designer at Northwind · Chicago, IL",
      description: sample.summary,
      url,
      type: "website",
    });
  });

  test("absolute job URLs are omitted without an origin", () => {
    expect(absoluteJobPageUrl(sample.id, "")).toBeUndefined();
    const meta = jobPageMetadata(sample, "");
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph?.url).toBeUndefined();
  });
});
