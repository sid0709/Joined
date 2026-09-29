import type { AuthCompany } from "@/lib/auth/types";
import { ROLE_META, canPermission, normalizeTeamRole, type TeamRole } from "@/lib/rbac";

export const COMPANY_CREATOR_ROLE = "Company creator";
export const COMPANY_RECRUITER_ROLE = "Recruiter";
export const COMPANY_PAGE_VIEW_NOTE = "Only the company creator can change this page.";

/** The person who created the company, including after ownership is transferred. */
export function canManageCompany(company: Pick<AuthCompany, "isCreator"> | null | undefined) {
  return company?.isCreator === true;
}

/**
 * Hiring role for soft client gates — mirrors Einstein ActorRole().
 * Creator is always owner; blank/unknown hiringRole falls back to recruiter
 * (or owner when membership role is owner).
 */
export function sessionHiringRole(
  company: Pick<AuthCompany, "isCreator" | "hiringRole" | "role"> | null | undefined,
): TeamRole | null {
  if (!company) return null;
  if (company.isCreator) return "owner";
  const raw = (company.hiringRole ?? "").trim().toLowerCase();
  if (raw) return normalizeTeamRole(raw);
  if (company.role === "owner") return "owner";
  return "recruiter";
}

/** Team settings: invite, manage roles, or audit. */
export function canOpenTeamSettings(
  company: Pick<AuthCompany, "isCreator" | "hiringRole" | "role"> | null | undefined,
) {
  const role = sessionHiringRole(company);
  return (
    canPermission(role, "team.invite") ||
    canPermission(role, "team.manage_roles") ||
    canPermission(role, "audit.view")
  );
}

/** Billing page: billing.view (finance + admin + owner). */
export function canOpenBilling(
  company: Pick<AuthCompany, "isCreator" | "hiringRole" | "role"> | null | undefined,
) {
  return canPermission(sessionHiringRole(company), "billing.view");
}

/** Company settings: team.manage_roles (owner + admin). */
export function canOpenCompanySettings(
  company: Pick<AuthCompany, "isCreator" | "hiringRole" | "role"> | null | undefined,
) {
  return canPermission(sessionHiringRole(company), "team.manage_roles");
}

export function companyRoleLabel(
  company: Pick<AuthCompany, "isCreator" | "hiringRole" | "role"> | null | undefined,
) {
  const role = sessionHiringRole(company);
  if (role) return ROLE_META[role].label;
  return canManageCompany(company) ? COMPANY_CREATOR_ROLE : COMPANY_RECRUITER_ROLE;
}
