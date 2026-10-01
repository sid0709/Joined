/** Public company page fields. Same record the admin company drawer edits. */

export const TAGLINE_MAX = 140;
export const ABOUT_MAX = 2000;
export const MISSION_MAX = 800;
export const MAX_SPECIALTIES = 12;
export const MAX_VALUES = 6;
export const MAX_BENEFIT_GROUPS = 6;
export const MAX_BENEFIT_ITEMS = 12;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const TAGLINE_SEPARATOR = " · ";
export const LOGO_MARK_SIZE = 64;

export { COMPANY_SIZES, COMPANY_TYPES, INDUSTRIES, VALUE_ICONS } from "@openseat/job-schema";

export type CompanyValue = {
  icon: string;
  title: string;
  description: string;
};

export type BenefitCategory = {
  label: string;
  items: string[];
};

/** The company page returned by GET /v1/company/page. */
export type CompanyPage = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  jobCount?: number;
  tagline?: string;
  about?: string;
  industry?: string;
  size?: string;
  founded?: number;
  replyDays?: number;
  headquarters?: string;
  companyType?: string;
  locations?: string;
  specialties?: string[];
  mission?: string;
  values?: CompanyValue[];
  benefitCategories?: BenefitCategory[];
  hasLogoFile?: boolean;
};

/** Every field the save sends, including blanks that clear a value. */
export type CompanyPageWrite = {
  name: string;
  url: string;
  logo: string;
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
};

export function emptyPageWrite(company: { name: string; url?: string }): CompanyPageWrite {
  return pageWriteFrom({ id: "", name: company.name, url: company.url });
}

export function pageWriteFrom(page: CompanyPage): CompanyPageWrite {
  return {
    name: page.name ?? "",
    url: page.url ?? "",
    logo: page.logo ?? "",
    tagline: page.tagline ?? "",
    about: page.about ?? "",
    industry: page.industry ?? "",
    size: page.size ?? "",
    founded: page.founded ?? 0,
    replyDays: page.replyDays ?? 0,
    headquarters: page.headquarters ?? "",
    companyType: page.companyType ?? "",
    locations: page.locations ?? "",
    specialties: page.specialties ?? [],
    mission: page.mission ?? "",
    values: page.values ?? [],
    benefitCategories: page.benefitCategories ?? [],
  };
}

export function selectOptions(
  values: readonly string[],
  current: string,
  label: (value: string) => string = (value) => value,
) {
  const known = values.includes(current);
  const list = current && !known ? [current, ...values] : [...values];
  return [
    { value: "", label: "Not set" },
    ...list.map((value) => ({ value, label: label(value) })),
  ];
}
