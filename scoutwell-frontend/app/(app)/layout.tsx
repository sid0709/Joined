import type { ReactNode } from "react";
import { GridColumn, GridSystem } from "@openseat/design-system";
import { PageContainer } from "@/components/page-container";
import { AppFrame } from "@/components/shell/app-frame";
import { AuthGuard } from "@/components/shell/auth-guard";
import { ScoutHeader } from "@/components/shell/scout-header";
import { ScoutNav } from "@/components/shell/scout-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppFrame header={<ScoutHeader />}>
      <PageContainer>
        <AuthGuard>
          <GridSystem gap={6}>
            <GridColumn span="full" lg={3}>
              <ScoutNav />
            </GridColumn>
            <GridColumn span="full" lg={9}>
              {children}
            </GridColumn>
          </GridSystem>
        </AuthGuard>
      </PageContainer>
    </AppFrame>
  );
}
