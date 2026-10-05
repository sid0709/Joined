import type { Job, PublicCompany } from "./types";
import type { GlyphName } from "sid-ui";

const OFFICE_LIMIT = 3;
const VALUE_ICONS: GlyphName[] = [
  "heart",
  "star",
  "users",
  "check",
  "sparkle",
  "home",
  "pin",
  "code",
  "seat",
  "chat",
];

export type CompanyValue = { icon: GlyphName; title: string; description: string };
export type BenefitCategory = { label: string; items: string[] };

/**
 * The public company profile. Fields saved on the company record come through as-is.
 * Anything still unset stays `undefined` so the page can render a skeleton instead of
 * inventing a fact. Offices still come from this company's live jobs unless offices
 * were saved on the company.
 */
export type PresentedCompany = {
  id: string;
  slug: string;
  name: string;
  logo?: string;
  url?: string;
  /** Job locations, deduped — real, derived from this company's live postings. */
  locations?: string;
  about: string;
  tagline?: string;
  industry?: string;
  size?: string;
  founded?: number;
  /** Median days from application to first reply. */
  replyDays?: number;
  headquarters?: string;
  companyType?: string;
  specialties?: string[];
  mission?: string;
  values?: CompanyValue[];
  benefitCategories?: BenefitCategory[];
  /** Flat list of benefit and perk items, for cards. */
  benefits?: string[];
  hasLogoFile?: boolean;
};

export function companyFromJob(job: Job): PublicCompany | null {
  const id = job.companyId?.trim();
  if (!id) return null;
  if (job.companyProfile) {
    return {
      ...job.companyProfile,
      id,
      name: job.companyProfile.name?.trim() || job.company,
    };
  }
  return {
    id,
    name: job.company,
    url: job.companyUrl?.trim() || undefined,
    logo: job.companyLogo?.trim() || undefined,
  };
}

export function jobHasLogoFile(job: Job) {
  return Boolean(job.companyProfile?.hasLogoFile);
}

export function openRolesFor(companyId: string, jobs: Job[]) {
  return jobs.filter((job) => job.companyId === companyId).length;
}

/** Same-origin logo URL. Third-party hosts block the browser from loading their files directly. */
export function companyLogoSrc(companyId?: string, logo?: string, hasFile = false, version = 0) {
  const raw = logo?.trim();
  if (raw?.startsWith("/") || raw?.startsWith("blob:") || raw?.startsWith("data:")) {
    return raw;
  }
  const id = companyId?.trim();
  if (id && (raw || hasFile)) {
    const base = `/companies/${encodeURIComponent(id)}/logo`;
    return version > 0 ? `${base}?v=${version}` : base;
  }
  return undefined;
}

export function presentCompany(company: PublicCompany, jobs: Job[]): PresentedCompany {
  const companyJobs = jobs.filter((job) => job.companyId === company.id);
  const offices = [...new Set(companyJobs.map((job) => job.location.trim()).filter(Boolean))].slice(
    0,
    OFFICE_LIMIT,
  );

  const savedLocations = text(company.locations);
  const values = company.values
    ?.map((value) => ({
      icon: valueIcon(value.icon),
      title: value.title?.trim() ?? "",
      description: value.description?.trim() ?? "",
    }))
    .filter((value) => value.title);
  const benefitCategories = company.benefitCategories
    ?.map((category) => ({
      label: category.label?.trim() ?? "",
      items: (category.items ?? []).map((item) => item.trim()).filter(Boolean),
    }))
    .filter((category) => category.label && category.items.length > 0);
  const benefits = benefitCategories?.flatMap((category) => category.items);

  return {
    id: company.id,
    slug: company.id,
    name: company.name,
    logo: company.logo,
    url: company.url,
    locations: savedLocations ?? (offices.length > 0 ? offices.join(" · ") : undefined),
    about:
      text(company.about) ??
      `${company.name} posts roles on its own site. Joined keeps the listing, the company page, and the application link together.`,
    tagline:
      text(company.tagline) ?? (companyJobs.length > 0 ? `${company.name} is hiring.` : undefined),
    industry: text(company.industry),
    size: text(company.size),
    founded: company.founded || undefined,
    replyDays: company.replyDays || undefined,
    headquarters: text(company.headquarters),
    companyType: text(company.companyType),
    specialties: list(company.specialties),
    mission: text(company.mission),
    values: values && values.length > 0 ? values : undefined,
    benefitCategories:
      benefitCategories && benefitCategories.length > 0 ? benefitCategories : undefined,
    benefits: benefits && benefits.length > 0 ? benefits : undefined,
    hasLogoFile: company.hasLogoFile || undefined,
  };
}

function text(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function list(items?: string[]) {
  const cleaned = items?.map((item) => item.trim()).filter(Boolean);
  return cleaned && cleaned.length > 0 ? cleaned : undefined;
}

function valueIcon(icon: string): GlyphName {
  return VALUE_ICONS.includes(icon as GlyphName) ? (icon as GlyphName) : "star";
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
