"use client";

import { usePathname } from "next/navigation";
import { PillNav, useAppShellMobile, type PillNavItem } from "sid-ui";
import { ROUTES } from "@/lib/routes";

const ITEMS: PillNavItem[] = [
  { href: ROUTES.overview, label: "Statistics", icon: "home" },
  { href: ROUTES.profile, label: "Profile", icon: "user" },
  { href: ROUTES.resume, label: "Resume", icon: "file" },
  { href: ROUTES.gmail, label: "Gmail", icon: "mail" },
  { href: ROUTES.apps, label: "Apps", icon: "grid" },
  { href: ROUTES.billing, label: "Billing", icon: "creditCard" },
];

/** The pill whose page holds `pathname`; Resume stays lit on /resume/library and /resume/history. */
function activeFor(pathname: string) {
  const match = ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.href ?? ROUTES.overview;
}

/** The workspace pages as pills; the current one opens to show its name. */
export function WorkspaceNav({ placement = "top" }: { placement?: "top" | "bottom" }) {
  return (
    <PillNav
      label="Acorn"
      items={ITEMS}
      activeHref={activeFor(usePathname())}
      placement={placement}
    />
  );
}

/** On small screens the pills leave the header for a bar along the bottom edge. */
export function MobileWorkspaceNav() {
  const { isMobile } = useAppShellMobile();
  return isMobile ? <WorkspaceNav placement="bottom" /> : null;
}
