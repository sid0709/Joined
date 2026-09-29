import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ResumesWorkspace } from "@/components/resumes/resumes-workspace";
import { RESUMES_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: RESUMES_PAGE.label };

export default function ResumesPage() {
  return (
    <PageContainer>
      <PageHeader title={RESUMES_PAGE.label} description={RESUMES_PAGE.description} />
      <ResumesWorkspace />
    </PageContainer>
  );
}
