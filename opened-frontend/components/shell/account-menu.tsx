"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  DropdownMenu,
  Icon,
  icons,
  useToast,
  type DropdownMenuItemData,
  type DropdownMenuOption,
} from "@openseat/design-system";
import { useSwitchMode } from "@/components/onboarding/use-switch-mode";
import { WORKSPACE } from "@/lib/company";
import { PROFILE } from "@/lib/profile";
import {
  COMPANY_ABOUT_PAGE,
  COMPANY_BILLING_PAGE,
  COMPANY_TEAM_PAGE,
  PROFILE_PAGE,
  RESUMES_PAGE,
  ROUTES,
  SETTINGS_PAGE,
  type PageLink,
  type WorkspaceMode,
} from "@/lib/routes";

const MENU_WIDTH = 300;
const TRIGGER_AVATAR = 24;
const HEADER_AVATAR = 32;

type IconType = (typeof icons)["file"];

/** Each mode's account menu: who you are there, that mode's own pages, and the way across. */
const MODE_MENU: Record<
  WorkspaceMode,
  {
    role: string;
    identityHref: string;
    links: { page: PageLink; icon: IconType }[];
    switchTo: WorkspaceMode;
    switchLabel: string;
    switchIcon: IconType;
  }
> = {
  hunter: {
    role: PROFILE.email,
    identityHref: ROUTES.profile,
    links: [
      { page: PROFILE_PAGE, icon: icons.user },
      { page: RESUMES_PAGE, icon: icons.file },
      { page: SETTINGS_PAGE, icon: icons.settings },
    ],
    switchTo: "company",
    switchLabel: "Switch to hiring",
    switchIcon: icons.users,
  },
  company: {
    role: `Owner · ${WORKSPACE.name}`,
    identityHref: ROUTES.companySettings,
    links: [
      { page: COMPANY_ABOUT_PAGE, icon: icons.seat },
      { page: COMPANY_TEAM_PAGE, icon: icons.users },
      { page: COMPANY_BILLING_PAGE, icon: icons.file },
    ],
    switchTo: "hunter",
    switchLabel: "Switch to job search",
    switchIcon: icons.search,
  },
};

export function AccountMenu({ mode }: { mode: WorkspaceMode }) {
  const router = useRouter();
  const toast = useToast();
  const switchMode = useSwitchMode();
  const menu = MODE_MENU[mode];

  const identity: DropdownMenuItemData = {
    id: "identity",
    label: PROFILE.name,
    description: menu.role,
    icon: <Avatar name={PROFILE.name} size={HEADER_AVATAR} tooltip={false} />,
    onClick: () => router.push(menu.identityHref),
  };

  const items: DropdownMenuOption[] = [
    identity,
    { type: "divider" },
    ...menu.links.map(({ page, icon }) => ({
      id: page.href,
      label: page.label,
      icon,
      onClick: () => router.push(page.href),
    })),
    { type: "divider" },
    {
      id: "switch",
      label: menu.switchLabel,
      icon: menu.switchIcon,
      onClick: () => switchMode(menu.switchTo),
    },
    {
      id: "sign-out",
      label: "Sign out",
      icon: <Icon icon={icons.arrowRight} />,
      onClick: () => toast({ body: "Signed out" }),
    },
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
      items={items}
    />
  );
}
