"use client";

import { usePathname } from "next/navigation";
import { BrandHeading, TopNav, TopNavItem, useAppShellMobile } from "@joined/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { APPLICATIONS_PAGE, BRAND, INTERVIEWS_PAGE, ROUTES, type PageLink } from "@/lib/routes";
import { AccountMenu } from "./account-menu";
import { ForEmployersNavItem, GuestActions } from "./guest-actions";
import { InboxNavItem } from "./inbox-nav-item";

const FIND_JOBS: PageLink = { href: ROUTES.search, label: "Find jobs", description: "" };
/** Anyone can search; the rest of the journey belongs to an account. */
const GUEST_NAV: PageLink[] = [FIND_JOBS];
const MEMBER_NAV: PageLink[] = [FIND_JOBS, APPLICATIONS_PAGE, INTERVIEWS_PAGE];

function isActive(pathname: string, href: string) {
  if (href === ROUTES.search) return pathname === href || pathname.startsWith("/jobs/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The candidate header. Signed in: the job-search journey, the inbox, and the
 * account menu. Signed out: search only, with ways to sign in or sign up.
 */
export function SeekerHeader({
  session,
  unread = 0,
}: {
  session: AuthSession | null;
  unread?: number;
}) {
  const pathname = usePathname();
  const { isMobile } = useAppShellMobile();
  const nav = session ? MEMBER_NAV : GUEST_NAV;

  return (
    <TopNav
      label={BRAND}
      heading={<BrandHeading product={BRAND} headingHref={ROUTES.search} />}
      startContent={
        <>
          {nav.map((link) => (
            <TopNavItem
              key={link.href}
              label={link.label}
              href={link.href}
              isSelected={isActive(pathname, link.href)}
            />
          ))}
          {!session && isMobile ? <ForEmployersNavItem /> : null}
        </>
      }
      endContent={
        session ? (
          <>
            <InboxNavItem href={ROUTES.messages} unread={unread} />
            <AccountMenu mode="hunter" session={session} />
          </>
        ) : (
          <GuestActions isCompact={isMobile} />
        )
      }
    />
  );
}
