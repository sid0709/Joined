import type { Job, PublicCompany } from "./types";
import type { GlyphName } from "@openseat/design-system";

const OFFICE_LIMIT = 3;
const SKILLS_LIMIT = 6;

export type CompanyValue = { icon: GlyphName; title: string; description: string };
export type Leader = { name: string; title: string };
export type BenefitCategory = { label: string; items: string[] };

/**
 * The public company profile. Athens only stores id, name, url, and logo — everything
 * else here is left `undefined` (or empty) until the backend actually has it, so the
 * page can render a skeleton for it instead of inventing a fact.
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
  leadership?: Leader[];
  benefitCategories?: BenefitCategory[];
  perks?: string[];
  /** Job skills, deduped — real, derived from this company's live postings. */
  techStack?: string[];
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
  const companyJobs = jobs.filter((job) => job.companyId === company.id);
  const offices = [...new Set(companyJobs.map((job) => job.location.trim()).filter(Boolean))].slice(
    0,
    OFFICE_LIMIT,
  );
  const skills = [...new Set(companyJobs.flatMap((job) => job.skills))].slice(0, SKILLS_LIMIT);

  return {
    id: company.id,
    slug: company.id,
    name: company.name,
    logo: company.logo,
    url: company.url,
    locations: offices.length > 0 ? offices.join(" · ") : undefined,
    about: `${company.name} posts roles on its own site. Opened keeps the listing, the company page, and the application link together.`,
    tagline: companyJobs.length > 0 ? `${company.name} is hiring.` : undefined,
    techStack: skills.length > 0 ? skills : undefined,
  };
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
