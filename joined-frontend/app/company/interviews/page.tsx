import type { Metadata } from "next";
import { Stack } from "sid-ui";
import { CompanyInterviewsWorkspace } from "@/components/company/interviews/company-interviews-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { sessionHiringRole } from "@/lib/company/access";
import { COMPANY_INTERVIEWS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company interviews" };

export default async function CompanyInterviewsPage() {
  const session = await loadSession();
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_INTERVIEWS_PAGE.label}
        description={COMPANY_INTERVIEWS_PAGE.description}
      />
      <CompanyInterviewsWorkspace actorRole={sessionHiringRole(session?.company)} />
    </Stack>
  );
}
