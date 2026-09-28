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
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";
import { AccountMenu } from "./account-menu";

export function ScoutHeader() {
  const pathname = usePathname();
  const { user, state } = useScout();
  const unread = user
    ? ownedBy(state.notifications, user.id).filter((item) => item.unread).length
    : 0;

  if (!user) {
    return (
      <TopNav
        label={BRAND}
        heading={
          <TopNavHeading
            heading={BRAND}
            headingHref={ROUTES.home}
            headerEndContent={<Badge label="Scouts" variant="blue" />}
          />
        }
        endContent={
          <>
            <ThemeToggle />
            <Button label="Sign in" variant="secondary" size="sm" href={ROUTES.signIn} />
            <Button label="Become a scout" variant="primary" size="sm" href={ROUTES.signUp} />
          </>
        }
      />
    );
  }

  return (
    <TopNav
      label={BRAND}
      heading={
        <TopNavHeading
          heading={BRAND}
          headingHref={ROUTES.dashboard}
          headerEndContent={<Badge label="Scouts" variant="blue" />}
        />
      }
      endContent={
        <>
          <Button label="Submit a job" variant="primary" size="sm" href={ROUTES.submit} />
          <TopNavItem
            label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            href={ROUTES.notifications}
            isSelected={pathname === ROUTES.notifications}
          />
          {unread > 0 ? <Badge label={String(unread)} variant="info" /> : null}
          <ThemeToggle />
          <AccountMenu />
        </>
      }
    />
  );
}
