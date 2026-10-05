"use client";

import { usePathname } from "next/navigation";
import { PillNav, useAppShellMobile } from "sid-ui";
import { activeHref, navItems } from "@/lib/nav";

/** The scout's pages as pills; the current one opens to show its name. */
export function ScoutPillNav({
  inReview,
  unread,
  placement = "top",
}: {
  inReview: number;
  unread: number;
  placement?: "top" | "bottom";
}) {
  return (
    <PillNav
      label="Scout pages"
      items={navItems(inReview, unread)}
      activeHref={activeHref(usePathname())}
      placement={placement}
    />
  );
}

/** On small screens the pills leave the header for a bar along the bottom edge. */
export function ScoutMobilePillBar(props: { inReview: number; unread: number }) {
  const { isMobile } = useAppShellMobile();
  return isMobile ? <ScoutPillNav {...props} placement="bottom" /> : null;
}
