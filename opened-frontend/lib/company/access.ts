import type { AuthCompany } from "@/lib/auth/types";

export const COMPANY_CREATOR_ROLE = "Company creator";
export const COMPANY_RECRUITER_ROLE = "Recruiter";
export const COMPANY_PAGE_VIEW_NOTE = "Only the company creator can change this page.";

/** The person who created the company, including after ownership is transferred. */
export function canManageCompany(company: Pick<AuthCompany, "isCreator"> | null | undefined) {
  return company?.isCreator === true;
}

export function companyRoleLabel(company: Pick<AuthCompany, "isCreator"> | null | undefined) {
  return canManageCompany(company) ? COMPANY_CREATOR_ROLE : COMPANY_RECRUITER_ROLE;
}
