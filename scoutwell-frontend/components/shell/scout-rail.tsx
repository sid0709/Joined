"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppRail } from "@openseat/design-system";
import { RAIL_COOKIE, RAIL_COOKIE_MAX_AGE, RAIL_COOKIE_VALUE_COLLAPSED } from "@/lib/config";
import { activeHref, railItems } from "@/lib/nav";

const RAIL_COOKIE_VALUE_EXPANDED = "expanded";

/** The workspace rail. Collapse is remembered in a cookie so the server draws the right width. */
export function ScoutRail({
  inReview,
  defaultCollapsed,
}: {
  inReview: number;
  defaultCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const change = (next: boolean) => {
    setIsCollapsed(next);
    const value = next ? RAIL_COOKIE_VALUE_COLLAPSED : RAIL_COOKIE_VALUE_EXPANDED;
    document.cookie = `${RAIL_COOKIE}=${value}; Path=/; Max-Age=${RAIL_COOKIE_MAX_AGE}; SameSite=Lax`;
  };

  return (
    <AppRail
      items={railItems(inReview)}
      activeHref={activeHref(pathname)}
      isCollapsed={isCollapsed}
      onCollapsedChange={change}
    />
  );
}
