import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { GridColumn, GridSystem, PageContainer } from "@openseat/design-system";
import { LEVEL_BADGE } from "@openseat/scout";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { ScoutNav } from "@/components/shell/scout-nav";
import { loadSession } from "@/lib/auth/session";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadStats } from "@/lib/scout/load";

/** Scout workspace: a signed-in person who accepted the scout terms. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, stats] = await Promise.all([loadSession(), loadStats()]);
  if (!session || !stats) redirect(signInHref(ROUTES.dashboard));
  if (!stats.profile.terms_accepted_at) redirect(ROUTES.onboarding);

  return (
    <AppFrame
      header={
        <ScoutHeader
          user={session.user}
          levelLabel={stats.level.label}
          unread={stats.unread_notifications}
        />
      }
    >
      <PageContainer>
        <GridSystem gap={6}>
          <GridColumn span="full" lg={3}>
            <ScoutNav
              name={session.user.name}
              levelLabel={stats.level.label}
              levelBadge={LEVEL_BADGE[stats.level.id]}
              inReview={stats.metrics.pending}
              unread={stats.unread_notifications}
            />
          </GridColumn>
          <GridColumn span="full" lg={9}>
            {children}
          </GridColumn>
        </GridSystem>
      </PageContainer>
    </AppFrame>
  );
}
