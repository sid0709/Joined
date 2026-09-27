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

  // Company pages have their own nav; in hiring mode this menu stays personal.
  const workspace: DropdownMenuOption[] = hiring
    ? [link(PROFILE_PAGE, icons.user), link(SETTINGS_PAGE, icons.settings)]
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
