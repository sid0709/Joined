"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  DropdownMenu,
  Icon,
  icons,
  type DropdownMenuItemData,
  type DropdownMenuOption,
} from "@openseat/design-system";
import { useSwitchMode } from "@/components/onboarding/use-switch-mode";
import type { AuthSession } from "@/lib/auth/types";
import { writeStoredWorkspaceMode } from "@/lib/workspace-preference";
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
    identityHref: string;
    links: { page: PageLink; icon: IconType }[];
    switchTo: WorkspaceMode;
    switchLabel: string;
    switchIcon: IconType;
  }
> = {
  hunter: {
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

function membershipLabel(session: AuthSession) {
  if (!session.company) return session.user.email;
  const title = session.company.role === "owner" ? "Owner" : "Member";
  return `${title} · ${session.company.name}`;
}

export function AccountMenu({
  mode,
  session,
}: {
  mode: WorkspaceMode;
  session: AuthSession | null;
}) {
  const router = useRouter();
  const switchMode = useSwitchMode();
  const menu = MODE_MENU[mode];
  const name = session?.user.name ?? "Account";

  const openHiring = () => {
    if (!session) {
      router.push(`${ROUTES.signUp}?intent=hiring`);
      return;
    }
    if (!session.company) {
      router.push(ROUTES.hiringSetup);
      return;
    }
    switchMode("company");
  };

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    writeStoredWorkspaceMode("hunter");
    router.push(ROUTES.search);
    router.refresh();
  };

  const identity: DropdownMenuItemData | null = session
    ? {
        id: "identity",
        label: session.user.name,
        description: mode === "company" ? membershipLabel(session) : session.user.email,
        icon: <Avatar name={session.user.name} size={HEADER_AVATAR} tooltip={false} />,
        onClick: () => router.push(menu.identityHref),
      }
    : null;

  const items: DropdownMenuOption[] = session
    ? [
        identity!,
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
          onClick: () => (menu.switchTo === "company" ? openHiring() : switchMode("hunter")),
        },
        {
          id: "sign-out",
          label: "Sign out",
          icon: <Icon icon={icons.arrowRight} />,
          onClick: () => void signOut(),
        },
      ]
    : [
        {
          id: "sign-in",
          label: "Sign in",
          icon: icons.user,
          onClick: () => router.push(`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.search)}`),
        },
        {
          id: "sign-up",
          label: "Create account",
          onClick: () => router.push(ROUTES.signUp),
        },
        {
          id: "switch",
          label: "Switch to hiring",
          icon: icons.users,
          onClick: openHiring,
        },
      ];

  return (
    <DropdownMenu
      button={{
        label: session ? name.split(" ")[0] : "Account",
        variant: "ghost",
        icon: <Avatar name={name} size={TRIGGER_AVATAR} tooltip={false} />,
      }}
      hasChevron
      alignment="end"
      menuWidth={MENU_WIDTH}
      items={items}
    />
  );
}
