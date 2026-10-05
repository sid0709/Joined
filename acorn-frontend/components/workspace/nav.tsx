"use client";

import { usePathname } from "next/navigation";
import { PillNav, useAppShellMobile, type PillNavItem } from "@joined/design-system";
import { ROUTES } from "@/lib/routes";

const ITEMS: PillNavItem[] = [
  { href: ROUTES.overview, label: "Statistics", icon: "home" },
  { href: ROUTES.profile, label: "Profile", icon: "user" },
  { href: ROUTES.resume, label: "Resume", icon: "file" },
  { href: ROUTES.gmail, label: "Gmail", icon: "mail" },
];

/** The workspace pages as pills; the current one opens to show its name. */
export function WorkspaceNav({ placement = "top" }: { placement?: "top" | "bottom" }) {
  const pathname = usePathname();
  const active = ITEMS.some((item) => item.href === pathname) ? pathname : ROUTES.overview;
  return <PillNav label="Acorn" items={ITEMS} activeHref={active} placement={placement} />;
}

/** On small screens the pills leave the header for a bar along the bottom edge. */
export function MobileWorkspaceNav() {
  const { isMobile } = useAppShellMobile();
  return isMobile ? <WorkspaceNav placement="bottom" /> : null;
}
