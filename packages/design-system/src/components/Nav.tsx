"use client";

import { ReactNode } from "react";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";

export interface NavItem {
  label: string;
  active?: boolean;
  href?: string;
}

export interface NavProps {
  brand?: ReactNode;
  items?: NavItem[];
  cta?: string;
  onCtaClick?: () => void;
  initials?: string;
  trailing?: ReactNode;
  showAvatar?: boolean;
  showThemeToggle?: boolean;
}

/** The 48px top-level product bar — calm infrastructure, never a second accent. */
export function Nav({
  brand = "OpenSeat",
  items = [],
  cta,
  onCtaClick,
  initials = "JM",
  trailing,
  showAvatar = false,
  showThemeToggle = false,
}: NavProps) {
  return (
    <div className="os-nav">
      <span className="h3 os-nav-brand">{brand}</span>
      <div className="os-nav-items">
        {items.map((it) => (
          <a
            key={it.label}
            href={it.href ?? "#"}
            className={"label os-nav-item" + (it.active ? " os-nav-item-active" : "")}
          >
            {it.label}
          </a>
        ))}
      </div>
      <div className="os-nav-right">
        {showThemeToggle && <ThemeToggle />}
        {cta && (
          <Button variant="primary" size="sm" onClick={onCtaClick}>
            {cta}
          </Button>
        )}
        {trailing}
        {showAvatar && <Avatar initials={initials} size={24} />}
      </div>
    </div>
  );
}

export const TopNav = Nav;
export type TopNavProps = NavProps;
