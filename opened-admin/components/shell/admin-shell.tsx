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
import { ConsoleNav, type NavCounts } from "./console-nav";

const CONTENT_PADDING = 6;

function counts(overview: Overview | null): NavCounts {
  if (!overview) return {};
  return {
    queue: overview.needs_review,
    verifications: overview.pending_verifications,
    payouts: overview.pending_payouts,
  };
}

/** Top bar, staff navigation, and the centered content column. */
export function AdminShell({
  overview,
  children,
}: {
  overview: Overview | null;
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
      sideNav={<ConsoleNav counts={counts(overview)} />}
    >
      <PageContainer width="wide">{children}</PageContainer>
    </AppShell>
  );
}
