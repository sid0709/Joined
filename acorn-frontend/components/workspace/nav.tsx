"use client";

import { usePathname } from "next/navigation";
import { PillNav, type GlyphName } from "@joined/design-system";
import { ROUTES } from "@/lib/routes";

const ITEMS: { href: string; label: string; icon: GlyphName }[] = [
  { href: ROUTES.overview, label: "Statistics", icon: "home" },
  { href: ROUTES.profile, label: "Profile", icon: "user" },
  { href: ROUTES.resume, label: "Resume", icon: "file" },
  { href: ROUTES.gmail, label: "Gmail", icon: "mail" },
];

export function WorkspaceNav() {
  const pathname = usePathname();
  const active = ITEMS.some((item) => item.href === pathname) ? pathname : ROUTES.overview;
  return (
    <div className="acorn-workspace-nav">
      <PillNav label="Acorn" items={ITEMS} activeHref={active} />
    </div>
  );
}
