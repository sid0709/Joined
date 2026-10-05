import type { Employment, Job, Pay, PayPeriod } from "@/lib/jobs";
import { websiteHref } from "@/lib/jobs/company";
import { BRAND } from "@/lib/routes";

import {
  JOB_POSTING_TYPE,
  MONETARY_AMOUNT_TYPE,
  MS_PER_HOUR,
  ORGANIZATION_TYPE,
  PLACE_TYPE,
  POSTAL_ADDRESS_TYPE,
  PROPERTY_VALUE_TYPE,
  QUANTITATIVE_VALUE_TYPE,
  SCHEMA_CONTEXT,
  TELECOMMUTE_LOCATION,
} from "./constants";

export type JobPostingOptions = {
  pageUrl?: string;
  now?: Date;
  /** ISO 8601. Catalog jobs have no expiry field today; omit when unset. */
  validThrough?: string;
};

export type JobPostingJsonLd = {
  "@context": string;
  "@type": string;
  title: string;
  description: string;
  datePosted: string;
  hiringOrganization: {
    "@type": string;
    name: string;
    sameAs?: string;
    logo?: string;
  };
  jobLocation: {
    "@type": string;
    address: { "@type": string; addressLocality: string };
  };
  employmentType: string;
  identifier: { "@type": string; name: string; value: string };
  directApply: boolean;
  url?: string;
  validThrough?: string;
  jobLocationType?: string;
  baseSalary?: {
    "@type": string;
    currency: string;
    value: {
      "@type": string;
      minValue?: number;
      maxValue?: number;
      unitText: string;
    };
  };
};

export function datePostedIso(postedHoursAgo: number, now = new Date()): string {
  const hours = Math.max(0, postedHoursAgo);
  return new Date(now.getTime() - hours * MS_PER_HOUR).toISOString();
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function jobPostingJsonLd(job: Job, options: JobPostingOptions = {}): JobPostingJsonLd {
  const now = options.now ?? new Date();
  const posting: JobPostingJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": JOB_POSTING_TYPE,
    title: job.title,
    description: jobPostingDescription(job),
    datePosted: datePostedIso(job.postedHoursAgo, now),
    hiringOrganization: hiringOrganization(job, options.pageUrl),
    jobLocation: {
      "@type": PLACE_TYPE,
      address: {
        "@type": POSTAL_ADDRESS_TYPE,
        addressLocality: job.location.trim() || job.workplace,
      },
    },
    employmentType: employmentTypeForSchema(job.employment),
    identifier: {
      "@type": PROPERTY_VALUE_TYPE,
      name: BRAND,
      value: job.id,
    },
    directApply: job.source === "direct",
  };

  const salary = baseSalary(job.pay);
  if (salary) posting.baseSalary = salary;
  if (options.pageUrl) posting.url = options.pageUrl;
  if (options.validThrough) posting.validThrough = options.validThrough;
  if (job.workplace === "remote") posting.jobLocationType = TELECOMMUTE_LOCATION;

  return posting;
}

function jobPostingDescription(job: Job): string {
  const summary = job.summary.trim();
  if (summary) return summary;
  return job.title;
}

function hiringOrganization(job: Job, pageUrl?: string) {
  const org: JobPostingJsonLd["hiringOrganization"] = {
    "@type": ORGANIZATION_TYPE,
    name: job.company,
  };
  const sameAs = organizationUrl(job.companyUrl ?? job.companyProfile?.url);
  if (sameAs) org.sameAs = sameAs;
  const logo = organizationLogo(job, pageUrl);
  if (logo) org.logo = logo;
  return org;
}

function organizationUrl(value?: string): string | undefined {
  const href = value ? websiteHref(value) : "";
  return href || undefined;
}

function organizationLogo(job: Job, pageUrl?: string): string | undefined {
  const raw = (job.companyLogo ?? job.companyProfile?.logo)?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/") && pageUrl) {
    try {
      return new URL(raw, pageUrl).toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function baseSalary(pay: Pay): JobPostingJsonLd["baseSalary"] | undefined {
  if (pay.min <= 0 && pay.max <= 0) return undefined;
  const value: NonNullable<JobPostingJsonLd["baseSalary"]>["value"] = {
    "@type": QUANTITATIVE_VALUE_TYPE,
    unitText: salaryUnit(pay.period),
  };
  if (pay.min > 0) value.minValue = pay.min;
  if (pay.max > 0) value.maxValue = pay.max;
  return {
    "@type": MONETARY_AMOUNT_TYPE,
    currency: pay.currency,
    value,
  };
}

function employmentTypeForSchema(employment: Employment): string {
  switch (employment) {
    case "full-time":
      return "FULL_TIME";
    case "part-time":
      return "PART_TIME";
    case "contract":
      return "CONTRACTOR";
    default: {
      const _exhaustive: never = employment;
      return _exhaustive;
    }
  }
}

function salaryUnit(period: PayPeriod): string {
  switch (period) {
    case "year":
      return "YEAR";
    case "hour":
      return "HOUR";
    default: {
      const _exhaustive: never = period;
      return _exhaustive;
    }
  }
}
