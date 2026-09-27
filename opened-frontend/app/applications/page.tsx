import type { Metadata } from "next";
import { ApplicationsWorkspace } from "@/components/applications/applications-workspace";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { APPLICATIONS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: APPLICATIONS_PAGE.label };

export default function ApplicationsPage() {
  return (
    <PageContainer>
      <PageHeader
        title={APPLICATIONS_PAGE.label}
        description="Drag a card to move it between stages. Click the eye to see its details."
      />
      <ApplicationsWorkspace />
    </PageContainer>
  );
}
