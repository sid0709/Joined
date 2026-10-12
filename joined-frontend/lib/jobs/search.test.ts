import { describe, expect, it } from "bun:test";

import { JOBS } from "./data";
import {
  annualPay,
  formatCount,
  formatPay,
  PAY_UNKNOWN_LABEL,
  formatPayWithSource,
  formatPosted,
  isNew,
  paySourceLabel,
} from "./format";
import {
  DEFAULT_FILTERS,
  PAY_FLOOR_MAX,
  applySuggestion,
  clearRefinements,
  countRefinements,
  facetCounts,
  filterJobs,
  parseFilters,
  serializeFilters,
  similarJobs,
  sortJobs,
  type JobFilters,
} from "./search";
import type { Job } from "./types";

const job = (id: string) => JOBS.find((item) => item.id === id) as Job;
const withFilters = (patch: Partial<JobFilters>): JobFilters => ({ ...DEFAULT_FILTERS, ...patch });

describe("job formatting", () => {
  it("formats salaried and hourly pay", () => {
    expect(formatPay(job("product-designer-northwind").pay)).toBe("$140k–$170k");
    expect(formatPay(job("brand-designer-fieldnote").pay)).toBe("$80–$100/hr");
    const usd = { currency: "USD", period: "year" } as const;
    expect(formatPay({ ...usd, min: 0, max: 0 })).toBe(PAY_UNKNOWN_LABEL);
    expect(formatPay({ ...usd, min: 120_000, max: 0 })).toBe("$120k+");
    expect(formatPay({ ...usd, min: 0, max: 150_000 })).toBe("Up to $150k");
    expect(formatPay({ ...usd, min: 150_000, max: 150_000 })).toBe("$150k");
  });

  it("says whether a range is listed or an estimate", () => {
    const listed = job("product-designer-northwind").pay;
    expect(paySourceLabel(listed)).toBe("Listed");
    expect(formatPayWithSource(listed)).toBe("$140k–$170k · Listed");
    expect(formatPayWithSource({ ...listed, estimated: true })).toBe("$140k–$170k · Estimated");
    expect(
      paySourceLabel({ min: 0, max: 0, currency: "USD", period: "year", estimated: true }),
    ).toBe("");
  });

  it("annualizes hourly pay so it compares with salaries", () => {
    expect(annualPay(job("brand-designer-fieldnote").pay)).toBe(208_000);
    expect(annualPay(job("brand-designer-fieldnote").pay, "min")).toBe(166_400);
  });

  it("describes how long ago a job was posted", () => {
    expect(formatPosted(0.5)).toBe("Just now");
    expect(formatPosted(4)).toBe("4h ago");
    expect(formatPosted(30)).toBe("Yesterday");
    expect(formatPosted(120)).toBe("5d ago");
    expect(isNew(job("engineering-manager-lumen"))).toBe(true);
    expect(isNew(job("support-lead-harbor"))).toBe(false);
  });

  it("pluralizes counts", () => {
    expect(formatCount(1, "job")).toBe("1 job");
    expect(formatCount(1200, "job")).toBe("1,200 jobs");
    expect(formatCount(2, "company", "companies")).toBe("2 companies");
  });
});

describe("job search filters", () => {
  it("round-trips through the URL and drops defaults", () => {
    const filters = withFilters({
      q: "designer",
      where: "Chicago",
      workplace: ["remote", "hybrid"],
      seniority: ["Senior"],
      employment: ["contract"],
      source: ["scouted"],
      minPay: 150_000,
      posted: "7d",
      visa: true,
      sort: "newest",
      list: "saved",
    });
    const query = serializeFilters(filters);
    expect(parseFilters(Object.fromEntries(new URLSearchParams(query)))).toEqual(filters);
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("ignores unknown or malformed params", () => {
    const parsed = parseFilters({
      workplace: "moon,remote",
      pay: "abc",
      sort: "random",
      posted: ["3d", "7d"],
    });
    expect(parsed.workplace).toEqual(["remote"]);
    expect(parsed.minPay).toBe(0);
    expect(parsed.sort).toBe("relevance");
    expect(parsed.posted).toBe("3d");
  });

  it("matches every search word across title, company, and skills", () => {
    const ids = filterJobs(JOBS, withFilters({ q: "designer northwind" })).map(({ id }) => id);
    expect(ids).toEqual(["product-designer-northwind", "interaction-designer-northwind"]);
    expect(filterJobs(JOBS, withFilters({ q: "pytorch" }))).toHaveLength(1);
  });

  it("combines refinements", () => {
    const results = filterJobs(JOBS, withFilters({ workplace: ["remote"], visa: true }));
    expect(results.every((item) => item.workplace === "remote" && item.visa)).toBe(true);
    expect(
      filterJobs(JOBS, withFilters({ posted: "24h" })).every((item) => item.postedHoursAgo <= 24),
    ).toBe(true);
    expect(
      filterJobs(JOBS, withFilters({ minPay: 200_000 })).every(
        (item) => annualPay(item.pay) >= 200_000,
      ),
    ).toBe(true);
    expect(
      filterJobs(JOBS, withFilters({ where: "remote" })).every(
        (item) => item.workplace === "remote",
      ),
    ).toBe(true);
  });

  it("counts facets without their own filter applied", () => {
    const filters = withFilters({ workplace: ["remote"], seniority: ["Senior"] });
    const counts = facetCounts(JOBS, filters, "workplace");
    const seniorJobs = JOBS.filter((item) => item.seniority === "Senior");
    expect(counts.get("remote")).toBe(
      seniorJobs.filter((item) => item.workplace === "remote").length,
    );
    expect(counts.get("hybrid")).toBe(
      seniorJobs.filter((item) => item.workplace === "hybrid").length,
    );
  });

  it("counts and clears refinements but keeps the search", () => {
    const filters = withFilters({
      q: "design",
      workplace: ["remote", "hybrid"],
      visa: true,
      sort: "pay",
    });
    expect(countRefinements(filters)).toBe(3);
    const cleared = clearRefinements(filters);
    expect(countRefinements(cleared)).toBe(0);
    expect(cleared.q).toBe("design");
    expect(cleared.sort).toBe("pay");
  });
});

describe("job sorting", () => {
  it("sorts a held list by recency, pay, and competition", () => {
    const newest = sortJobs(JOBS, "newest");
    expect(newest[0].postedHoursAgo).toBe(Math.min(...JOBS.map((item) => item.postedHoursAgo)));
    const pay = sortJobs(JOBS, "pay");
    expect(annualPay(pay[0].pay)).toBe(Math.max(...JOBS.map((item) => annualPay(item.pay))));
    const applicants = sortJobs(JOBS, "applicants");
    expect(applicants[0].applicants).toBe(Math.min(...JOBS.map((item) => item.applicants)));
  });

  it("keeps the server's order for relevance and recommended", () => {
    expect(sortJobs(JOBS, "relevance").map((item) => item.id)).toEqual(JOBS.map((item) => item.id));
    expect(sortJobs(JOBS, "recommended").map((item) => item.id)).toEqual(
      JOBS.map((item) => item.id),
    );
  });

  it("finds similar jobs by shared skills", () => {
    const similar = similarJobs(job("product-designer-northwind"), JOBS, 3);
    expect(similar).toHaveLength(3);
    expect(similar.some((item) => item.id === "product-designer-northwind")).toBe(false);
  });
});

describe("filter suggestions", () => {
  it("turns each suggestion into the filter it names", () => {
    const base = withFilters({ workplace: ["hybrid"] });
    expect(applySuggestion(base, { kind: "workplace", value: "remote", label: "Remote" })).toEqual({
      workplace: ["hybrid", "remote"],
    });
    expect(applySuggestion(base, { kind: "seniority", value: "Senior", label: "Senior" })).toEqual({
      seniority: ["Senior"],
    });
    expect(applySuggestion(base, { kind: "visa", value: "true", label: "Visa sponsor" })).toEqual({
      visa: true,
    });
    expect(applySuggestion(base, { kind: "postedDays", value: "7", label: "Past week" })).toEqual({
      posted: "7d",
    });
    expect(applySuggestion(base, { kind: "minPay", value: "155000", label: "$155k+" })).toEqual({
      minPay: 150_000,
    });
    expect(applySuggestion(base, { kind: "minPay", value: "900000", label: "$900k+" })).toEqual({
      minPay: PAY_FLOOR_MAX,
    });
  });
});
