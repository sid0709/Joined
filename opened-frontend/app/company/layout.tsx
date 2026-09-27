import type { ReactNode } from "react";
import { GridColumn, GridSystem } from "@openseat/design-system";
import { CompanyNav } from "@/components/company/company-nav";
import { PageContainer } from "@/components/page-container";

/** Every hiring page shares the workspace nav on the left. */
export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
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
  );
}
