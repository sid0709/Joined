"use client";

import { usePathname } from "next/navigation";
import { Badge, Icon, TopNav, TopNavHeading, TopNavItem, icons } from "@openseat/design-system";
import { UNREAD_MESSAGES } from "@/lib/account";
import { APPLICATIONS_PAGE, BRAND, INTERVIEWS_PAGE, ROUTES, type PageLink } from "@/lib/routes";
import { AccountMenu } from "./account-menu";

const FIND_JOBS: PageLink = { href: ROUTES.search, label: "Find jobs", description: "" };
const NAV: PageLink[] = [FIND_JOBS, APPLICATIONS_PAGE, INTERVIEWS_PAGE];

function isActive(pathname: string, href: string) {
  if (href === ROUTES.search) return pathname === href || pathname.startsWith("/jobs/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The candidate header: the job-search journey up top, the account menu on the right. */
export function SeekerHeader() {
  const pathname = usePathname();

  return (
    <TopNav
      label={BRAND}
      heading={<TopNavHeading heading={BRAND} headingHref={ROUTES.search} />}
      startContent={
        <>
          {NAV.map((link) => (
            <TopNavItem
              key={link.href}
              label={link.label}
              href={link.href}
              isSelected={isActive(pathname, link.href)}
            />
          ))}
        </>
      }
      endContent={
        <>
          <TopNavItem
            label="Messages"
            isIconOnly
            icon={<Icon icon={icons.mail} />}
            href={ROUTES.messages}
          >
            <Badge label={String(UNREAD_MESSAGES)} variant="info" />
          </TopNavItem>
          <AccountMenu mode="hunter" />
        </>
      }
    />
  );
}
