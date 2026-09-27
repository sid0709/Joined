import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { TeamWorkspace } from "@/components/company/team/team-workspace";
import { PageHeader } from "@/components/page-header";
import { COMPANY_TEAM_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_TEAM_PAGE.label };

export default function TeamPage() {
  return (
    <Stack gap={6}>
      <PageHeader title={COMPANY_TEAM_PAGE.label} description={COMPANY_TEAM_PAGE.description} />
      <TeamWorkspace />
    </Stack>
  );
}
