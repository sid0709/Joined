import type { Metadata } from "next";
import { ApplicationsWorkspace } from "@/components/applications/applications-workspace";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { loadApplications } from "@/lib/me/load";
import { APPLICATIONS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: APPLICATIONS_PAGE.label };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await loadApplications();
  return (
    <PageContainer>
      <PageHeader
        title={APPLICATIONS_PAGE.label}
        description="Saved jobs land in the first column. Drag a card to move stages, and open one to add notes or a reminder."
      />
      <ApplicationsWorkspace initial={applications} />
    </PageContainer>
  );
}
