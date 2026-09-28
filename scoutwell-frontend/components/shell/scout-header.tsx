"use client";

import { usePathname } from "next/navigation";
import {
  Badge,
  Button,
  ThemeToggle,
  TopNav,
  TopNavHeading,
  TopNavItem,
} from "@openseat/design-system";
import type { SessionUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { AccountMenu } from "./account-menu";

/** The product bar. Signed out it sells; signed in it puts Submit and notifications in reach. */
export function ScoutHeader({
  user = null,
  levelLabel = "",
  unread = 0,
}: {
  user?: SessionUser | null;
  levelLabel?: string;
  unread?: number;
}) {
  const pathname = usePathname();
  const heading = (
    <TopNavHeading
      heading={BRAND}
      headingHref={user ? ROUTES.dashboard : ROUTES.home}
      headerEndContent={<Badge label="Scouts" variant="blue" />}
    />
  );

  if (!user) {
    return (
      <TopNav
        label={BRAND}
        heading={heading}
        endContent={
          <>
            <ThemeToggle />
            <Button label="Sign in" variant="ghost" size="sm" href={ROUTES.signIn} />
            <Button label="Become a scout" variant="primary" size="sm" href={ROUTES.signUp} />
          </>
        }
      />
    );
  }

  return (
    <TopNav
      label={BRAND}
      heading={heading}
      endContent={
        <>
          <Button label="Submit a job" variant="primary" size="sm" href={ROUTES.submit} />
          <TopNavItem
            label="Notifications"
            href={ROUTES.notifications}
            isSelected={pathname === ROUTES.notifications}
          />
          {unread > 0 ? <Badge label={`${unread} new`} variant="info" /> : null}
          <ThemeToggle />
          <AccountMenu user={user} levelLabel={levelLabel} />
        </>
      }
    />
  );
}
