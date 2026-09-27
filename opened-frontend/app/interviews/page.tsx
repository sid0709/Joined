import type { Metadata } from "next";
import { InterviewsWorkspace } from "@/components/interviews/interviews-workspace";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { INTERVIEWS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: INTERVIEWS_PAGE.label };

export default function InterviewsPage() {
  return (
    <PageContainer>
      <PageHeader title={INTERVIEWS_PAGE.label} description={INTERVIEWS_PAGE.description} />
      <InterviewsWorkspace />
    </PageContainer>
  );
}
