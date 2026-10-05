import type { Employment, Job, Pay, PayPeriod } from "@/lib/jobs";
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

const HTTP_URL = /^https?:\/\//i;

const SCHEMA_EMPLOYMENT = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  contract: "CONTRACTOR",
} as const satisfies Record<Employment, string>;

const SCHEMA_PAY_UNIT = {
  year: "YEAR",
  hour: "HOUR",
} as const satisfies Record<PayPeriod, string>;

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
    employmentType: SCHEMA_EMPLOYMENT[job.employment],
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
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return isHttpUrl(trimmed) ? trimmed : `https://${trimmed}`;
}

function organizationLogo(job: Job, pageUrl?: string): string | undefined {
  const raw = (job.companyLogo ?? job.companyProfile?.logo)?.trim();
  if (!raw) return undefined;
  if (isHttpUrl(raw)) return raw;
  if (!raw.startsWith("/") || !pageUrl || !isHttpUrl(pageUrl)) return undefined;
  return new URL(raw, pageUrl).toString();
}

function isHttpUrl(value: string): boolean {
  return HTTP_URL.test(value);
}

function baseSalary(pay: Pay): JobPostingJsonLd["baseSalary"] | undefined {
  if (pay.min <= 0 && pay.max <= 0) return undefined;
  const value: NonNullable<JobPostingJsonLd["baseSalary"]>["value"] = {
    "@type": QUANTITATIVE_VALUE_TYPE,
    unitText: SCHEMA_PAY_UNIT[pay.period],
  };
  if (pay.min > 0) value.minValue = pay.min;
  if (pay.max > 0) value.maxValue = pay.max;
  return {
    "@type": MONETARY_AMOUNT_TYPE,
    currency: pay.currency,
    value,
  };
}
