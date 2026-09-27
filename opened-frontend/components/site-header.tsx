"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  DropdownMenu,
  Icon,
  TopNav,
  TopNavHeading,
  TopNavItem,
  icons,
} from "@openseat/design-system";
import { useWorkspaceMode } from "@/components/providers";
import { UNREAD_MESSAGES } from "@/lib/account";
import {
  BRAND,
  COMPANY_LINKS,
  HUNTER_LINKS,
  ROUTES,
  type PageLink,
} from "@/lib/routes";

const HUNTER_ICONS = {
  [ROUTES.applications]: icons.list,
  [ROUTES.interviews]: icons.calendar,
  [ROUTES.resumes]: icons.file,
  [ROUTES.profile]: icons.user,
  [ROUTES.settings]: icons.settings,
} as const;

const COMPANY_ICONS = {
  [ROUTES.company]: icons.home,
  [ROUTES.companyJobs]: icons.folder,
  [ROUTES.companyApplicants]: icons.users,
  [ROUTES.companyInterviews]: icons.calendar,
  [ROUTES.companyAbout]: icons.seat,
  [ROUTES.companyTeam]: icons.users,
  [ROUTES.companyBilling]: icons.file,
  [ROUTES.companySettings]: icons.settings,
} as const;

const MENU_WIDTH = 280;

function menuItems(links: PageLink[], iconsByHref: Record<string, (typeof icons)["file"]>, go: (href: string) => void) {
  return links.map((link) => ({
    label: link.label,
    description: link.description,
    icon: iconsByHref[link.href],
    onClick: () => go(link.href),
  }));
}

export function SiteHeader() {
  const router = useRouter();
  const { mode } = useWorkspaceMode();
  const hiring = mode === "company";
  const go = (href: string) => router.push(href);

  return (
    <TopNav
      label={BRAND}
      heading={<TopNavHeading heading={BRAND} headingHref={ROUTES.search} />}
      startContent={
        <>
          <TopNavItem label="Find jobs" href={ROUTES.search} isSelected={!hiring} />
          <TopNavItem label="Hiring" href={ROUTES.company} isSelected={hiring} />
        </>
      }
      endContent={
        <>
          {hiring ? (
            <Button
              label="Post a job"
              variant="primary"
              size="sm"
              href={ROUTES.companyJobNew}
              icon={<Icon icon={icons.plus} />}
            />
          ) : null}
          <TopNavItem label="Messages" isIconOnly icon={<Icon icon={icons.mail} />} href={ROUTES.messages}>
            <Badge label={String(UNREAD_MESSAGES)} variant="info" />
          </TopNavItem>
          <DropdownMenu
            button={{ label: "Account", variant: "ghost", icon: <Icon icon={icons.user} /> }}
            menuWidth={MENU_WIDTH}
            items={
              hiring
                ? menuItems(COMPANY_LINKS, COMPANY_ICONS, go)
                : menuItems(HUNTER_LINKS, HUNTER_ICONS, go)
            }
          />
        </>
      }
    />
  );
}
