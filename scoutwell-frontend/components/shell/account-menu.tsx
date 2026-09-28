"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  DropdownMenu,
  icons,
  useAppShellMobile,
  type DropdownMenuOption,
} from "@openseat/design-system";
import { ACCOUNT_PAGE, PAYOUTS_PAGE, ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { LEVELS } from "@/lib/config";

const MENU_WIDTH = 300;
const TRIGGER_AVATAR = 24;
const HEADER_AVATAR = 32;

export function AccountMenu() {
  const router = useRouter();
  const { isMobile } = useAppShellMobile();
  const { user, signOut } = useScout();
  if (!user) return null;

  const items: DropdownMenuOption[] = [
    {
      id: "identity",
      label: user.name,
      description: `${LEVELS[user.level].label} · ${user.email}`,
      icon: <Avatar name={user.name} size={HEADER_AVATAR} tooltip={false} />,
      onClick: () => router.push(ACCOUNT_PAGE.href),
    },
    { type: "divider" },
    {
      id: ACCOUNT_PAGE.href,
      label: ACCOUNT_PAGE.label,
      icon: icons.user,
      onClick: () => router.push(ACCOUNT_PAGE.href),
    },
    {
      id: PAYOUTS_PAGE.href,
      label: PAYOUTS_PAGE.label,
      icon: icons.settings,
      onClick: () => router.push(PAYOUTS_PAGE.href),
    },
    { type: "divider" },
    {
      id: "sign-out",
      label: "Sign out",
      icon: icons.signOut,
      onClick: () => {
        signOut();
        router.push(ROUTES.home);
      },
    },
  ];

  return (
    <DropdownMenu
      button={{
        label: user.name.split(" ")[0],
        isIconOnly: isMobile,
        variant: "ghost",
        icon: <Avatar name={user.name} size={TRIGGER_AVATAR} tooltip={false} />,
      }}
      hasChevron={!isMobile}
      alignment="end"
      menuWidth={MENU_WIDTH}
      items={items}
    />
  );
}
