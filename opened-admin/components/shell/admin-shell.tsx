import type { ReactNode } from "react";
import {
  AppShell,
  PageContainer,
  ThemeToggle,
  TopNav,
  Badge,
  BrandHeading,
} from "@joined/design-system";
import type { Overview } from "@joined/scout";
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
    cases: trust.cases,
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
            <BrandHeading
              product={BRAND}
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
