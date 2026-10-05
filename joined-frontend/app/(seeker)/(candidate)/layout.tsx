import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isEmployee } from "@/lib/auth/account-type";
import { loadSession } from "@/lib/auth/session";
import { isCompanyModeEnabled } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/**
 * Job search and a candidate's own pages. An employee account has no use for
 * them — it goes straight to its hiring workspace (when company mode is enabled).
 */
export default async function CandidateLayout({ children }: { children: ReactNode }) {
  if (isCompanyModeEnabled() && isEmployee(await loadSession())) {
    redirect(ROUTES.company);
  }
  return children;
}
