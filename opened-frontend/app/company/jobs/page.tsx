import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { CompanyJobsWorkspace } from "@/components/company/jobs/company-jobs-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { sessionHiringRole } from "@/lib/company/access";
import { COMPANY_JOBS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_JOBS_PAGE.label };

export default async function CompanyJobsPage() {
  const session = await loadSession();
  return (
    <Stack gap={6}>
      <PageHeader title={COMPANY_JOBS_PAGE.label} description={COMPANY_JOBS_PAGE.description} />
      <CompanyJobsWorkspace actorRole={sessionHiringRole(session?.company)} />
    </Stack>
  );
}
