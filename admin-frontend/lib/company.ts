import { COMPANY_SIZES, MAX_BENEFITS, VALUE_ICONS, type CompanySize } from "@joined/job-schema";
import { adminDownload, adminFetch } from "@/lib/api";
import { API_PROXY } from "@/lib/config";

export const COMPANIES_PATH = "/v1/companies";
export const COMPANIES_PAGE_SIZE = 25;
/** Staged copies on the company migration page. */
export const TEMP_COMPANIES_PATH = "/v1/companies/temp";
export const TEMP_COMPANIES_EXPORT_PATH = "/v1/companies/temp/export";
export const TEMP_COMPANIES_IMPORT_PATH = "/v1/companies/temp/import";
export const STAGED_COMPANIES_FILE = "staged-companies.json";
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export { COMPANY_SIZES, COMPANY_TYPES, INDUSTRIES, VALUE_ICONS } from "@joined/job-schema";
export type { ValueIcon } from "@joined/job-schema";

/** PATCH /v1/companies/{id} body keys. Matches backend-core/jobs/postman_analyze.go. */
export const COMPANY_WRITE_KEYS = [
  "name",
  "url",
  "logo",
  "tagline",
  "about",
  "industry",
  "size",
  "founded",
  "replyDays",
  "headquarters",
  "companyType",
  "locations",
  "specialties",
  "mission",
  "values",
  "benefitCategories",
] as const;

const MAX_COMPANY_NAME = 80;
const MAX_COMPANY_URL = 300;
const MAX_COMPANY_LOGO = 500;
const MIN_FOUNDED_YEAR = 1800;
const MAX_FOUNDED_YEAR = 2100;
const MAX_REPLY_DAYS = 365;

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

/** One Directory → Companies row: the company's main fields and how complete its page is. */
export type CompanyRow = CompanySummary & {
  tagline?: string;
  size?: string;
  companyType?: string;
  headquarters?: string;
  founded?: number;
  locations?: string;
  verification?: string;
  /** Percentage of the public page's fields that are filled in. */
  completion: number;
  researchedAt?: string;
};

export type CompanyDirectory = {
  companies: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** Research state of a company still in staging. */
export const STAGED_COMPANY_STATUS = {
  waiting: "waiting",
  notFound: "not_found",
} as const;

export type StagedCompanyStatus =
  (typeof STAGED_COMPANY_STATUS)[keyof typeof STAGED_COMPANY_STATUS];

/** One company migration row: a copy waiting for research, or one research could not find. */
export type StagedCompany = {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  jobCount: number;
  hasLogoFile?: boolean;
  status: StagedCompanyStatus;
  researchedAt?: string;
};

export type StagedCompanyList = {
  companies: StagedCompany[];
  total: number;
  page: number;
  pageSize: number;
};

/** What POST /v1/companies/temp/import reports after a valid file. */
export type CompanyImportResult = {
  published: number;
  unmatched: string[];
};

/** Downloads every staged company. Empty profile fields are null. */
export function downloadStagedCompanies() {
  return adminDownload(TEMP_COMPANIES_EXPORT_PATH, STAGED_COMPANIES_FILE);
}

/** Publishes staged companies that match a filled export file. */
export function importStagedCompanies(body: string) {
  return adminFetch<CompanyImportResult>(TEMP_COMPANIES_IMPORT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

export function stagedCompanyStatusLabel(status: StagedCompanyStatus): string {
  switch (status) {
    case STAGED_COMPANY_STATUS.waiting:
      return "Waiting";
    case STAGED_COMPANY_STATUS.notFound:
      return "Not found";
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

/** Sort keys GET /v1/companies accepts. */
export const COMPANY_SORTS = {
  name: "name",
  jobs: "jobs",
  completion: "completion",
  founded: "founded",
  researched: "researched",
} as const;

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

export function companyWriteJSON(draft: CompanyWrite) {
  return JSON.stringify(draft, null, 2);
}

/** Parses and validates a company PATCH body before save. */
export function parseCompanyWriteJSON(text: string): CompanyWrite | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "JSON is not valid" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Expected a JSON object" };
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(COMPANY_WRITE_KEYS as readonly string[]).includes(key)) {
      return { error: `Unknown field "${key}"` };
    }
  }
  let draft: CompanyWrite;
  try {
    draft = {
      name: readString(record, "name"),
      url: readString(record, "url"),
      logo: readString(record, "logo"),
      tagline: readString(record, "tagline"),
      about: readString(record, "about"),
      industry: readString(record, "industry"),
      size: readString(record, "size"),
      founded: readCount(record, "founded"),
      replyDays: readCount(record, "replyDays"),
      headquarters: readString(record, "headquarters"),
      companyType: readString(record, "companyType"),
      locations: readString(record, "locations"),
      specialties: readStringList(record, "specialties"),
      mission: readString(record, "mission"),
      values: readValues(record, "values"),
      benefitCategories: readBenefitCategories(record, "benefitCategories"),
    };
  } catch (cause) {
    if (cause instanceof FieldTypeError) {
      return { error: cause.message };
    }
    throw cause;
  }
  const problem = validateCompanyWrite(draft);
  return problem ? { error: problem } : draft;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new FieldTypeError(key, "string");
  }
  return value.trim();
}

function readCount(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new FieldTypeError(key, "integer");
  }
  return value;
}

class FieldTypeError extends Error {
  constructor(key: string, kind: string) {
    super(`${key} must be a ${kind}`);
  }
}

function readStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new FieldTypeError(key, "string array");
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new FieldTypeError(`${key}[${index}]`, "string");
    }
    return item.trim();
  });
}

function readValues(record: Record<string, unknown>, key: string): CompanyValue[] {
  const value = record[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new FieldTypeError(key, "array");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new FieldTypeError(`${key}[${index}]`, "object");
    }
    const row = item as Record<string, unknown>;
    return {
      icon: readNestedString(row, "icon", `${key}[${index}].icon`),
      title: readNestedString(row, "title", `${key}[${index}].title`),
      description: readNestedString(row, "description", `${key}[${index}].description`),
    };
  });
}

function readBenefitCategories(record: Record<string, unknown>, key: string): BenefitCategory[] {
  const value = record[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new FieldTypeError(key, "array");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new FieldTypeError(`${key}[${index}]`, "object");
    }
    const row = item as Record<string, unknown>;
    const items = row.items;
    if (items === undefined || items === null) {
      return {
        label: readNestedString(row, "label", `${key}[${index}].label`),
        items: [],
      };
    }
    if (!Array.isArray(items)) {
      throw new FieldTypeError(`${key}[${index}].items`, "string array");
    }
    return {
      label: readNestedString(row, "label", `${key}[${index}].label`),
      items: items.map((entry, itemIndex) => {
        if (typeof entry !== "string") {
          throw new FieldTypeError(`${key}[${index}].items[${itemIndex}]`, "string");
        }
        return entry.trim();
      }),
    };
  });
}

function readNestedString(row: Record<string, unknown>, key: string, label: string): string {
  const value = row[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new FieldTypeError(label, "string");
  }
  return value.trim();
}

function validateCompanyWrite(draft: CompanyWrite): string | null {
  if (!draft.name.trim()) {
    return "name is required";
  }
  if (draft.name.length > MAX_COMPANY_NAME) {
    return "name is too long";
  }
  if (draft.url && !validCompanyLink(draft.url, MAX_COMPANY_URL)) {
    return "url is not a link";
  }
  if (draft.logo && !validCompanyLink(draft.logo, MAX_COMPANY_LOGO)) {
    return "logo is not a link";
  }
  if (draft.size) {
    const canonical = canonicalCompanySize(draft.size.replace(/-/g, "–"));
    if (!canonical) {
      return "size is not a listed company size";
    }
    draft.size = canonical;
  }
  if (
    draft.founded !== 0 &&
    (draft.founded < MIN_FOUNDED_YEAR || draft.founded > MAX_FOUNDED_YEAR)
  ) {
    return "founded is out of range";
  }
  if (draft.replyDays < 0 || draft.replyDays > MAX_REPLY_DAYS) {
    return "replyDays is out of range";
  }
  if (draft.benefitCategories.length > MAX_BENEFITS) {
    return `benefitCategories cannot exceed ${MAX_BENEFITS}`;
  }
  for (const value of draft.values) {
    if (value.icon && !VALUE_ICONS.includes(value.icon as (typeof VALUE_ICONS)[number])) {
      return `values icon "${value.icon}" is not listed`;
    }
  }
  return null;
}

function validCompanyLink(value: string, limit: number): boolean {
  if (value.length > limit || !value.includes(".")) {
    return false;
  }
  const lower = value.toLowerCase();
  if (lower.includes(" ") || lower.startsWith("javascript:")) {
    return false;
  }
  return true;
}

function canonicalCompanySize(size: string): CompanySize | null {
  const trimmed = size.trim();
  for (const option of COMPANY_SIZES) {
    if (option.toLowerCase() === trimmed.toLowerCase()) {
      return option;
    }
  }
  return null;
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
