import type { Metadata } from "next";
import { InterviewsWorkspace } from "@/components/interviews/interviews-workspace";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { loadApplications, loadInterviews } from "@/lib/me/pipeline";
import { INTERVIEWS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: INTERVIEWS_PAGE.label };
export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const [interviews, applications] = await Promise.all([loadInterviews(), loadApplications()]);
  return (
    <PageContainer>
      <PageHeader title={INTERVIEWS_PAGE.label} description={INTERVIEWS_PAGE.description} />
      <InterviewsWorkspace initial={interviews} applications={applications} />
    </PageContainer>
  );
}
