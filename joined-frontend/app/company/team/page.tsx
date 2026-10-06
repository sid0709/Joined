import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stack } from "sid-ui";
import { TeamWorkspace } from "@/components/company/team/team-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { canOpenTeamSettings, sessionHiringRole } from "@/lib/company/access";
import { COMPANY_TEAM_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_TEAM_PAGE.label };

export default async function TeamPage() {
  const session = await loadSession();
  if (!session) redirect(signInHref(ROUTES.companyTeam));
  if (!canOpenTeamSettings(session.company)) redirect(ROUTES.company);
  return (
    <Stack gap={6}>
      <PageHeader title={COMPANY_TEAM_PAGE.label} description={COMPANY_TEAM_PAGE.description} />
      <TeamWorkspace actorRole={sessionHiringRole(session.company)} />
    </Stack>
  );
}
