import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PageContainer } from "sid-ui";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { ScoutMobilePillBar } from "@/components/shell/scout-pill-nav";
import { loadSession } from "@/lib/auth/session";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadStats } from "@/lib/scout/load";

/** Scout workspace: a signed-in person who accepted the scout terms. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [session, stats] = await Promise.all([loadSession(), loadStats()]);
  if (!session || !stats) redirect(signInHref(ROUTES.dashboard));
  if (!stats.profile.terms_accepted_at) redirect(ROUTES.onboarding);

  const inReview = stats.metrics.pending;
  const unread = stats.unread_notifications;

  return (
    <AppFrame
      header={
        <ScoutHeader
          user={session.user}
          levelLabel={stats.level.label}
          unread={unread}
          inReview={inReview}
        />
      }
    >
      <PageContainer>{children}</PageContainer>
      <ScoutMobilePillBar inReview={inReview} unread={unread} />
    </AppFrame>
  );
}
