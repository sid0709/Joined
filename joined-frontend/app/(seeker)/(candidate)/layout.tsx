import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Center } from "@joined/design-system";
import { CompanyModeComing } from "@/components/auth/company-mode-coming";
import { isEmployee } from "@/lib/auth/account-type";
import { loadSession } from "@/lib/auth/session";
import { isCompanyModeEnabled } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/**
 * Job search and a candidate's own pages. An employee account has no use for
 * them — it goes straight to its hiring workspace (when company mode is enabled).
 * With company mode disabled, show a "coming soon" notice instead of rendering
 * candidate routes that would call candidate-only APIs and throw.
 */
export default async function CandidateLayout({ children }: { children: ReactNode }) {
  const companyModeEnabled = isCompanyModeEnabled();
  const session = await loadSession();
  const isEmployeeSession = isEmployee(session);

  if (companyModeEnabled && isEmployeeSession) {
    redirect(ROUTES.company);
  }

  if (!companyModeEnabled && isEmployeeSession) {
    return (
      <Center axis="both" minHeight="60vh">
        <CompanyModeComing />
      </Center>
    );
  }

  return children;
}
