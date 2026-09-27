import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { TeamPanel } from "@/components/team-panel";
import { COMPANY_TEAM_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_TEAM_PAGE.label };

export default function TeamPage() {
  return (
    <Stack gap={5} maxWidth={720}>
      <PageHeader title={COMPANY_TEAM_PAGE.label} description={COMPANY_TEAM_PAGE.description} />
      <TeamPanel />
    </Stack>
  );
}
