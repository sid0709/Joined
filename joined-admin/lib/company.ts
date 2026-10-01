import { API_PROXY } from "@/lib/config";

export const COMPANIES_PATH = "/v1/companies";
export const COMPANIES_PAGE_SIZE = 25;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export { COMPANY_SIZES, COMPANY_TYPES, INDUSTRIES, VALUE_ICONS } from "@joined/job-schema";
export type { ValueIcon } from "@joined/job-schema";

export type CompanyValue = {
  icon: string;
  title: string;
  description: string;
};

export type BenefitCategory = {
  label: string;
  items: string[];
};

/** Matches the admin company record returned by GET/PATCH /v1/companies/{id}. */
export type AdminCompany = {
  id: string;
  name: string;
  url: string;
  logo: string;
  jobCount: number;
  tagline: string;
  about: string;
  industry: string;
  size: string;
  founded: number;
  replyDays: number;
  headquarters: string;
  companyType: string;
  locations: string;
  specialties: string[];
  mission: string;
  values: CompanyValue[];
  benefitCategories: BenefitCategory[];
  hasLogoFile?: boolean;
};

export type CompanySummary = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  industry?: string;
  jobCount: number;
  hasLogoFile?: boolean;
};

export type CompanyList = {
  companies: CompanySummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type CompanyWrite = Omit<AdminCompany, "id" | "jobCount" | "hasLogoFile">;

/** Same-origin API logo for uploads and LinkedIn files that refuse hotlinking. */
export function companyLogoSrc(
  company: { id: string; logo?: string; hasLogoFile?: boolean },
  version = 0,
) {
  const logo = company.logo?.trim();
  if (!logo && !company.hasLogoFile) return undefined;
  if (logo && !isLinkedInLogoHost(logo)) return logo;
  const base = `${API_PROXY}/v1/companies/${encodeURIComponent(company.id)}/logo`;
  return `${base}?v=${version}`;
}

function isLinkedInLogoHost(logo: string) {
  let host = "";
  try {
    host = new URL(logo).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === "linkedin.com" ||
    host.endsWith(".linkedin.com") ||
    host === "licdn.com" ||
    host.endsWith(".licdn.com")
  );
}

export function companyWriteFrom(company: AdminCompany): CompanyWrite {
  return {
    name: company.name ?? "",
    url: company.url ?? "",
    logo: company.logo ?? "",
    tagline: company.tagline ?? "",
    about: company.about ?? "",
    industry: company.industry ?? "",
    size: company.size ?? "",
    founded: company.founded ?? 0,
    replyDays: company.replyDays ?? 0,
    headquarters: company.headquarters ?? "",
    companyType: company.companyType ?? "",
    locations: company.locations ?? "",
    specialties: company.specialties ?? [],
    mission: company.mission ?? "",
    values: company.values ?? [],
    benefitCategories: company.benefitCategories ?? [],
  };
}

/** What POST /v1/companies/{id}/autofill returns: a draft to review. Nothing is saved. */
export type CompanyAutofill = {
  company: CompanyWrite;
  sources: string[];
};

export function autofillPath(companyId: string) {
  return `${COMPANIES_PATH}/${encodeURIComponent(companyId)}/autofill`;
}

/**
 * Lays an autofill draft over the form. Anything the search could not find stays as it
 * was, and so do the logo and reply time, which the web cannot tell us.
 */
export function applyAutofill(draft: CompanyWrite, found: CompanyWrite): CompanyWrite {
  const text = (next: string, current: string) => (next.trim() ? next : current);
  const list = <T>(next: T[], current: T[]) => (next.length ? next : current);
  return {
    ...draft,
    name: text(found.name, draft.name),
    url: text(draft.url, found.url),
    tagline: text(found.tagline, draft.tagline),
    about: text(found.about, draft.about),
    industry: text(found.industry, draft.industry),
    size: text(found.size, draft.size),
    founded: found.founded > 0 ? found.founded : draft.founded,
    headquarters: text(found.headquarters, draft.headquarters),
    companyType: text(found.companyType, draft.companyType),
    locations: text(found.locations, draft.locations),
    specialties: list(found.specialties, draft.specialties),
    mission: text(found.mission, draft.mission),
    values: list(found.values, draft.values),
    benefitCategories: list(found.benefitCategories, draft.benefitCategories),
  };
}
