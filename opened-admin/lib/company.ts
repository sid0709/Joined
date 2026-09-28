import { adminApiUrl } from "@/lib/config";

export const COMPANIES_PATH = "/v1/companies";
export const COMPANIES_PAGE_SIZE = 25;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export const INDUSTRIES = [
  "Accounting",
  "Advertising",
  "Agriculture",
  "Architecture",
  "Construction",
  "Consulting",
  "Education",
  "Energy",
  "Entertainment",
  "Finance",
  "Food",
  "Government",
  "Healthcare",
  "Hospitality",
  "Insurance",
  "Legal",
  "Manufacturing",
  "Media",
  "Nonprofit",
  "Real estate",
  "Retail",
  "Software",
  "Telecommunications",
  "Transportation",
] as const;

export const COMPANY_TYPES = [
  "Private",
  "Public",
  "Nonprofit",
  "Government",
  "Educational",
  "Partnership",
  "Cooperative",
] as const;

export const COMPANY_SIZES = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,000+",
] as const;

export const VALUE_ICONS = [
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
] as const;

export type ValueIcon = (typeof VALUE_ICONS)[number];

export type CompanyValue = {
  icon: string;
  title: string;
  description: string;
};

export type CompanyLeader = {
  name: string;
  title: string;
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
  leadership: CompanyLeader[];
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

/** Same-origin API logo. Uploaded files and remote URLs both load through it. */
export function companyLogoSrc(
  company: { id: string; logo?: string; hasLogoFile?: boolean },
  version = 0,
) {
  if (!company.logo && !company.hasLogoFile) return undefined;
  const base = `${adminApiUrl()}/v1/search/companies/${encodeURIComponent(company.id)}/logo`;
  return `${base}?v=${version}`;
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
    leadership: company.leadership ?? [],
    benefitCategories: company.benefitCategories ?? [],
  };
}
