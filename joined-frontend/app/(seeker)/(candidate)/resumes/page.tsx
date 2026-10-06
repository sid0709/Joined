import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ResumesWorkspace } from "@/components/resumes/resumes-workspace";
import { loadApplications, loadProfile } from "@/lib/me/load";
import { RESUMES_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: RESUMES_PAGE.label };
export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const [profile, applications] = await Promise.all([loadProfile(), loadApplications()]);
  if (!profile) redirect(signInHref(ROUTES.resumes));
  return (
    <PageContainer>
      <PageHeader title={RESUMES_PAGE.label} description={RESUMES_PAGE.description} />
      <ResumesWorkspace initialProfile={profile} applications={applications} />
    </PageContainer>
  );
}
