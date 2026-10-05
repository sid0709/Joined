import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { GridColumn, GridSystem } from "@joined/design-system";
import { CompanyNav } from "@/components/company/company-nav";
import { PageContainer } from "@/components/page-container";
import { AppFrame } from "@/components/shell/app-frame";
import { EmployerHeader } from "@/components/shell/employer-header";
import { loadCompanyCounts } from "@/lib/company/load";
import { loadCompanyUnread } from "@/lib/me/load";
import { loadSession } from "@/lib/auth/session";
import { ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Employer mode: a signed-in person linked to a company, with the workspace nav on the left. */
export default async function CompanyLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  if (!session) redirect(signInHref(ROUTES.company));
  if (session.user.role !== "employee") redirect(ROUTES.search);
  if (!session.company) redirect(ROUTES.hiringSetup);
  const unread = await loadCompanyUnread();
  const counts = await loadCompanyCounts();
  return (
    <AppFrame header={<EmployerHeader session={session} unread={unread} />}>
      <PageContainer>
        <GridSystem gap={6}>
          <GridColumn span="full" lg={3}>
            <CompanyNav
              company={session.company}
              unread={unread}
              openJobs={counts.openJobs}
              newApplicants={counts.newApplicants}
            />
          </GridColumn>
          <GridColumn span="full" lg={9}>
            {children}
          </GridColumn>
        </GridSystem>
      </PageContainer>
    </AppFrame>
  );
}
