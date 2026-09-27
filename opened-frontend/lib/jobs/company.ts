import type { CompanyProfile, Job, PublicCompany } from "./types";

const INDUSTRIES = [
  "Software",
  "Public sector technology",
  "Healthcare",
  "Financial services",
  "Developer tools",
  "Commerce",
] as const;

const SIZES = ["11–50", "51–200", "201–500", "501–1,000", "1,001–5,000"] as const;

const OFFICES = [
  "Remote",
  "United States",
  "New York · Remote",
  "San Francisco · Remote",
  "Chicago · New York",
] as const;

const PERK_SETS = [
  ["Hybrid, 2 days in office", "Learning budget", "Health coverage"],
  ["Remote-first", "Home office stipend", "16 weeks parental leave"],
  ["Visa sponsorship", "Learning budget", "Equity"],
] as const;

const FOUNDED_START = 1996;
const FOUNDED_SPAN = 25;
const REPLY_START = 2;
const REPLY_SPAN = 6;
const OFFICE_LIMIT = 3;

/** Stand-in profile fields. Athens only stores name, logo, and website. */
export type PresentedCompany = CompanyProfile & {
  id: string;
  logo?: string;
  url?: string;
  tagline: string;
  perks: string[];
  verified: boolean;
};

export function companyFromJob(job: Job): PublicCompany | null {
  const id = job.companyId?.trim();
  if (!id) return null;
  return {
    id,
    name: job.company,
    url: job.companyUrl?.trim() || undefined,
    logo: job.companyLogo?.trim() || undefined,
  };
}

export function openRolesFor(companyId: string, jobs: Job[]) {
  return jobs.filter((job) => job.companyId === companyId).length;
}

/** Same-origin logo URL. Third-party hosts block the browser from loading their files directly. */
export function companyLogoSrc(companyId?: string, logo?: string) {
  const raw = logo?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("/")) return raw;
  const id = companyId?.trim();
  if (!id) return undefined;
  return `/companies/${encodeURIComponent(id)}/logo`;
}

export function presentCompany(company: PublicCompany, jobs: Job[]): PresentedCompany {
  const seed = hash(company.id || company.name);
  const offices = [
    ...new Set(
      jobs
        .filter((job) => job.companyId === company.id)
        .map((job) => job.location.trim())
        .filter(Boolean),
    ),
  ].slice(0, OFFICE_LIMIT);

  return {
    id: company.id,
    slug: company.id,
    name: company.name,
    logo: company.logo,
    url: company.url,
    locations: offices.length > 0 ? offices.join(" · ") : OFFICES[seed % OFFICES.length],
    about: `${company.name} posts roles on its own site. Opened keeps the listing, the company page, and the application link together.`,
    industry: INDUSTRIES[seed % INDUSTRIES.length],
    size: SIZES[seed % SIZES.length],
    founded: FOUNDED_START + (seed % FOUNDED_SPAN),
    replyDays: REPLY_START + (seed % REPLY_SPAN),
    tagline: `${company.name} is hiring.`,
    perks: [...PERK_SETS[seed % PERK_SETS.length]],
    verified: true,
  };
}

function hash(value: string) {
  let sum = 0;
  for (const char of value) sum = (sum * 31 + char.charCodeAt(0)) >>> 0;
  return sum;
}

export function websiteHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function websiteLabel(url: string) {
  const href = websiteHref(url);
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return url.trim();
  }
}
