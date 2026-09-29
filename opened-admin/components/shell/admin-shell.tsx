import type { ReactNode } from "react";
import {
  AppShell,
  PageContainer,
  ThemeToggle,
  TopNav,
  TopNavHeading,
  Badge,
} from "@openseat/design-system";
import type { Overview } from "@openseat/scout";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/nav";
import type { TrustNavCounts } from "@/lib/trust";
import { ConsoleNav, type NavCounts } from "./console-nav";

const CONTENT_PADDING = 6;

function counts(overview: Overview | null, trust: TrustNavCounts): NavCounts {
  return {
    ...(overview
      ? {
          queue: overview.needs_review,
          verifications: overview.pending_verifications,
          payouts: overview.pending_payouts,
        }
      : {}),
    companyVerification: trust.companyVerification,
    directReview: trust.directReview,
  };
}

/** Top bar, staff navigation, and the centered content column. */
export function AdminShell({
  overview,
  trust,
  children,
}: {
  overview: Overview | null;
  trust: TrustNavCounts;
  children: ReactNode;
}) {
  return (
    <AppShell
      variant="wash"
      contentPadding={CONTENT_PADDING}
      topNav={
        <TopNav
          label={BRAND}
          heading={
            <TopNavHeading
              heading={BRAND}
              headingHref={ROUTES.scouting}
              headerEndContent={<Badge label="Staff" variant="neutral" />}
            />
          }
          endContent={<ThemeToggle />}
        />
      }
      sideNav={<ConsoleNav counts={counts(overview, trust)} />}
    >
      <PageContainer width="wide">{children}</PageContainer>
    </AppShell>
  );
}
