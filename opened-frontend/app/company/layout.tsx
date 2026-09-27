import type { ReactNode } from "react";
import { GridColumn, GridSystem } from "@openseat/design-system";
import { CompanyNav } from "@/components/company/company-nav";
import { PageContainer } from "@/components/page-container";
import { AppFrame } from "@/components/shell/app-frame";
import { EmployerHeader } from "@/components/shell/employer-header";

/** Employer mode: its own header, and the workspace nav on the left of every hiring page. */
export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <AppFrame header={<EmployerHeader />}>
      <PageContainer>
        <GridSystem gap={6}>
          <GridColumn span="full" lg={3}>
            <CompanyNav />
          </GridColumn>
          <GridColumn span="full" lg={9}>
            {children}
          </GridColumn>
        </GridSystem>
      </PageContainer>
    </AppFrame>
  );
}
