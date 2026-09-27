"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  DropdownMenu,
  Icon,
  icons,
  useToast,
  type DropdownMenuItemData,
  type DropdownMenuOption,
} from "@openseat/design-system";
import { APPLICATIONS, applicationStats } from "@/lib/applications";
import { INTERVIEWS, isUpcoming } from "@/lib/interviews";
import { PROFILE } from "@/lib/profile";
import {
  APPLICATIONS_PAGE,
  COMPANY_LINKS,
  INTERVIEWS_PAGE,
  PROFILE_PAGE,
  RESUMES_PAGE,
  ROUTES,
  SETTINGS_PAGE,
  type PageLink,
} from "@/lib/routes";

const MENU_WIDTH = 300;
const TRIGGER_AVATAR = 24;
const HEADER_AVATAR = 32;

const COMPANY_ICONS: Record<string, (typeof icons)["file"]> = {
  [ROUTES.company]: icons.home,
  [ROUTES.companyJobs]: icons.folder,
  [ROUTES.companyApplicants]: icons.users,
  [ROUTES.companyInterviews]: icons.calendar,
  [ROUTES.companyAbout]: icons.seat,
  [ROUTES.companyTeam]: icons.users,
  [ROUTES.companyBilling]: icons.file,
  [ROUTES.companySettings]: icons.settings,
};

const count = (value: number) =>
  value > 0 ? <Badge label={String(value)} variant="neutral" /> : undefined;

/** The avatar menu: who you are, where you can go, and how to leave. Hiring/job search switching lives in the top nav. */
export function AccountMenu({ hiring }: { hiring: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const go = (href: string) => router.push(href);
  const link = (
    page: PageLink,
    icon: (typeof icons)["file"],
    endContent?: DropdownMenuItemData["endContent"],
  ) => ({
    id: page.href,
    label: page.label,
    icon,
    endContent,
    onClick: () => go(page.href),
  });

  const identity: DropdownMenuItemData = {
    id: "identity",
    label: PROFILE.name,
    description: PROFILE.email,
    icon: <Avatar name={PROFILE.name} size={HEADER_AVATAR} tooltip={false} />,
    onClick: () => go(ROUTES.profile),
  };

  const workspace: DropdownMenuOption[] = hiring
    ? COMPANY_LINKS.map((page) => link(page, COMPANY_ICONS[page.href]))
    : [
        link(APPLICATIONS_PAGE, icons.list, count(applicationStats(APPLICATIONS).active)),
        link(INTERVIEWS_PAGE, icons.calendar, count(INTERVIEWS.filter(isUpcoming).length)),
        link(RESUMES_PAGE, icons.file),
        { type: "divider" },
        link(PROFILE_PAGE, icons.user),
        link(SETTINGS_PAGE, icons.settings),
      ];

  return (
    <DropdownMenu
      button={{
        label: PROFILE.name.split(" ")[0],
        variant: "ghost",
        icon: <Avatar name={PROFILE.name} size={TRIGGER_AVATAR} tooltip={false} />,
      }}
      hasChevron
      alignment="end"
      menuWidth={MENU_WIDTH}
      items={[
        identity,
        { type: "divider" },
        ...workspace,
        { type: "divider" },
        {
          id: "sign-out",
          label: "Sign out",
          icon: <Icon icon={icons.arrowRight} />,
          onClick: () => toast({ body: "Signed out" }),
        },
      ]}
    />
  );
}
