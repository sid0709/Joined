import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PageContainer } from "@openseat/design-system";
import { formatMoney } from "@openseat/scout";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { ScoutRail } from "@/components/shell/scout-rail";
import { loadSession } from "@/lib/auth/session";
import { RAIL_COOKIE, RAIL_COOKIE_VALUE_COLLAPSED } from "@/lib/config";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadStats } from "@/lib/scout/load";

/** Scout workspace: a signed-in person who accepted the scout terms. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, stats] = await Promise.all([loadSession(), loadStats()]);
  if (!session || !stats) redirect(signInHref(ROUTES.dashboard));
  if (!stats.profile.terms_accepted_at) redirect(ROUTES.onboarding);

  const railCollapsed = (await cookies()).get(RAIL_COOKIE)?.value === RAIL_COOKIE_VALUE_COLLAPSED;

  return (
    <AppFrame
      header={
        <ScoutHeader
          user={session.user}
          levelLabel={stats.level.label}
          unread={stats.unread_notifications}
          available={formatMoney(stats.balance.released)}
        />
      }
      nav={<ScoutRail inReview={stats.metrics.pending} defaultCollapsed={railCollapsed} />}
    >
      <PageContainer>{children}</PageContainer>
    </AppFrame>
  );
}
