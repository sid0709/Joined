"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { SideNav, SideNavItem } from "@astryxdesign/core/SideNav";

import { icons, type GlyphName } from "./Glyph";

import type { ReactNode } from "react";

export type AppRailLink = {
  href: string;
  label: string;
  /** Unread or pending count; hidden at zero. */
  count?: number;
};

export type AppRailItem = AppRailLink & {
  icon: GlyphName;
  /** Sub-pages that expand under the item. */
  children?: AppRailLink[];
};

export type AppRailProps = {
  /** Brand or workspace switcher, pinned at the top. */
  header?: ReactNode;
  /** The few places people work in every day. */
  items: AppRailItem[];
  /** Quieter destinations pinned above the profile (settings, help). */
  secondaryItems?: AppRailItem[];
  /** The signed-in person, pinned at the bottom. */
  footer?: ReactNode;
  /** The href that is current; the longest matching prefix should already be resolved. */
  activeHref?: string;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  collapseLabel?: string;
};

function countBadge(count: number | undefined) {
  return count && count > 0 ? <Badge label={String(count)} variant="neutral" /> : undefined;
}

function RailItem({ item, activeHref }: { item: AppRailItem; activeHref?: string }) {
  const childActive = item.children?.some((child) => child.href === activeHref) ?? false;
  return (
    <SideNavItem
      label={item.label}
      href={item.href}
      icon={<Icon icon={icons[item.icon]} />}
      isSelected={item.href === activeHref && !childActive}
      endContent={countBadge(item.count)}
      collapsible={
        item.children ? { defaultIsCollapsed: !childActive && item.href !== activeHref } : false
      }
    >
      {item.children?.map((child) => (
        <SideNavItem
          key={child.href}
          label={child.label}
          href={child.href}
          isSelected={child.href === activeHref}
          endContent={countBadge(child.count)}
        />
      ))}
    </SideNavItem>
  );
}

/**
 * The workspace's side rail: full width with labels, or a narrow icon strip when collapsed.
 * Sub-pages expand inline. Inside AppShell it turns into the mobile drawer on its own.
 * Collapse state is controlled so the app can persist it (a cookie keeps it flash-free).
 */
export function AppRail({
  header,
  items,
  secondaryItems = [],
  footer,
  activeHref,
  isCollapsed,
  onCollapsedChange,
  collapseLabel = "Collapse navigation",
}: AppRailProps) {
  return (
    <SideNav
      header={header}
      collapsible={{ isCollapsed, onCollapsedChange, buttonLabel: collapseLabel }}
      footer={
        <>
          {secondaryItems.map((item) => (
            <RailItem key={item.href} item={item} activeHref={activeHref} />
          ))}
          {footer}
        </>
      }
    >
      {items.map((item) => (
        <RailItem key={item.href} item={item} activeHref={activeHref} />
      ))}
    </SideNav>
  );
}
