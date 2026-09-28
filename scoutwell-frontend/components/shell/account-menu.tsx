"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  DropdownMenu,
  icons,
  useAppShellMobile,
  useToast,
  type DropdownMenuOption,
} from "@openseat/design-system";
import type { SessionUser } from "@/lib/auth/types";
import { ACCOUNT_PAGE, DEVELOPERS_PAGE, PAYOUTS_PAGE, ROUTES } from "@/lib/routes";
import { authSend } from "@/lib/scout/client";

const MENU_WIDTH = 300;
const TRIGGER_AVATAR = 24;
const HEADER_AVATAR = 32;

export function AccountMenu({ user, levelLabel }: { user: SessionUser; levelLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useAppShellMobile();

  const signOut = async () => {
    try {
      await authSend("signout");
      router.push(ROUTES.home);
      router.refresh();
    } catch {
      toast({ body: "Could not sign out. Try again.", type: "error" });
    }
  };

  const go = (href: string) => () => router.push(href);
  const items: DropdownMenuOption[] = [
    {
      id: "identity",
      label: user.name,
      description: levelLabel ? `${levelLabel} scout · ${user.email}` : user.email,
      icon: <Avatar name={user.name} size={HEADER_AVATAR} tooltip={false} />,
      onClick: go(ACCOUNT_PAGE.href),
    },
    { type: "divider" },
    {
      id: ACCOUNT_PAGE.href,
      label: ACCOUNT_PAGE.label,
      icon: icons.user,
      onClick: go(ACCOUNT_PAGE.href),
    },
    {
      id: PAYOUTS_PAGE.href,
      label: PAYOUTS_PAGE.label,
      icon: icons.file,
      onClick: go(PAYOUTS_PAGE.href),
    },
    {
      id: DEVELOPERS_PAGE.href,
      label: DEVELOPERS_PAGE.label,
      icon: icons.code,
      onClick: go(DEVELOPERS_PAGE.href),
    },
    { type: "divider" },
    { id: "sign-out", label: "Sign out", icon: icons.signOut, onClick: () => void signOut() },
  ];

  return (
    <DropdownMenu
      button={{
        label: user.name.split(" ")[0] ?? user.name,
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
