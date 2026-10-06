import { describe, expect, test } from "bun:test";

import { JOBS } from "@/lib/jobs/data";

import {
  SITEMAP_HOME_CHANGE,
  SITEMAP_HOME_PRIORITY,
  SITEMAP_JOB_CHANGE,
  SITEMAP_JOB_LIMIT,
  SITEMAP_JOB_PRIORITY,
} from "./constants";
import { publicSitemapEntries } from "./sitemap";

const ORIGIN = "https://joined.test";
const NOW = new Date("2026-10-05T18:00:00.000Z");

describe("public sitemap entries", () => {
  test("returns nothing without a public origin", () => {
    expect(publicSitemapEntries(JOBS, "")).toEqual([]);
  });

  test("starts with home and includes public job URLs", () => {
    const entries = publicSitemapEntries(JOBS.slice(0, 2), ORIGIN, NOW);
    expect(entries[0]).toEqual({
      url: `${ORIGIN}/`,
      lastModified: NOW,
      changeFrequency: SITEMAP_HOME_CHANGE,
      priority: SITEMAP_HOME_PRIORITY,
    });
    expect(entries[1]).toEqual({
      url: `${ORIGIN}/jobs/product-designer-northwind`,
      lastModified: new Date("2026-10-03T20:00:00.000Z"),
      changeFrequency: SITEMAP_JOB_CHANGE,
      priority: SITEMAP_JOB_PRIORITY,
    });
    expect(entries[2]?.url).toBe(`${ORIGIN}/jobs/frontend-engineer-harbor`);
    expect(entries).toHaveLength(3);
  });

  test("caps job URLs at the catalog sitemap limit", () => {
    const jobs = Array.from({ length: SITEMAP_JOB_LIMIT + 25 }, (_, index) => ({
      id: `job-${index}`,
      postedHoursAgo: 1,
    }));
    const entries = publicSitemapEntries(jobs, ORIGIN, NOW);
    expect(entries).toHaveLength(SITEMAP_JOB_LIMIT + 1);
    expect(entries.at(-1)?.url).toBe(`${ORIGIN}/jobs/job-${SITEMAP_JOB_LIMIT - 1}`);
  });
});
