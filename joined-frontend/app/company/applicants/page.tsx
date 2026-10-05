import type { Metadata } from "next";
import { Stack } from "sid-ui";
import { ApplicantsWorkspace } from "@/components/company/applicants/applicants-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { sessionHiringRole } from "@/lib/company/access";
import { COMPANY_APPLICANTS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_APPLICANTS_PAGE.label };

export default async function ApplicantsPage() {
  const session = await loadSession();
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_APPLICANTS_PAGE.label}
        description={COMPANY_APPLICANTS_PAGE.description}
      />
      <ApplicantsWorkspace actorRole={sessionHiringRole(session?.company)} />
    </Stack>
  );
}
