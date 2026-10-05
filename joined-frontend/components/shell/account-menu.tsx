"use client";

import { useRouter } from "next/navigation";
import { Avatar, DropdownMenu, icons, useAppShellMobile, type DropdownMenuOption } from "sid-ui";
import type { AuthSession } from "@/lib/auth/types";
import { companyRoleLabel } from "@/lib/company/access";
import { clearApplicationExtras } from "@/lib/application-extras";
import { writeStoredWorkspaceMode } from "@/lib/workspace-preference";
import {
  COMPANY_ACCOUNT_PAGE,
  COMPANY_PROFILE_PAGE,
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

/**
 * Each account's menu is about the person, not the company: who you are and
 * your own pages. Company pages (page, team, billing, settings) live in the
 * workspace rail. Accounts are one kind or the other, so there is no mode switch.
 */
const MODE_MENU: Record<WorkspaceMode, { links: { page: PageLink; icon: IconType }[] }> = {
  hunter: {
    links: [
      { page: PROFILE_PAGE, icon: icons.user },
      { page: RESUMES_PAGE, icon: icons.file },
      { page: SETTINGS_PAGE, icon: icons.settings },
    ],
  },
  company: {
    links: [
      { page: COMPANY_PROFILE_PAGE, icon: icons.user },
      { page: COMPANY_ACCOUNT_PAGE, icon: icons.settings },
    ],
  },
};

function identityLine(mode: WorkspaceMode, session: AuthSession) {
  if (mode !== "company" || !session.company) return session.user.email;
  return `${companyRoleLabel(session.company)} · ${session.company.name}`;
}

/** The signed-in account menu. Signed-out visitors get GuestActions instead. */
export function AccountMenu({ mode, session }: { mode: WorkspaceMode; session: AuthSession }) {
  const router = useRouter();
  const { isMobile } = useAppShellMobile();
  const menu = MODE_MENU[mode];
  const { name } = session.user;

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    clearApplicationExtras();
    writeStoredWorkspaceMode("hunter");
    router.push(ROUTES.search);
    router.refresh();
  };

  const items: DropdownMenuOption[] = [
    {
      id: "identity",
      label: name,
      description: identityLine(mode, session),
      icon: <Avatar name={name} size={HEADER_AVATAR} tooltip={false} />,
      onClick: () => router.push(menu.links[0].page.href),
    },
    { type: "divider" },
    ...menu.links.map(({ page, icon }) => ({
      id: page.href,
      label: page.label,
      icon,
      onClick: () => router.push(page.href),
    })),
    { type: "divider" },
    {
      id: "sign-out",
      label: "Sign out",
      icon: icons.signOut,
      onClick: () => void signOut(),
    },
  ];

  return (
    <DropdownMenu
      button={{
        label: name.split(" ")[0],
        // Phones keep just the avatar so the bar has room for the menu toggle.
        isIconOnly: isMobile,
        variant: "ghost",
        icon: <Avatar name={name} size={TRIGGER_AVATAR} tooltip={false} />,
      }}
      hasChevron={!isMobile}
      alignment="end"
      menuWidth={MENU_WIDTH}
      items={items}
    />
  );
}
