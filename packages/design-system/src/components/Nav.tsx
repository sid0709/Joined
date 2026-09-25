"use client";

import type { ReactNode } from "react";
import { Button } from "./Action";
import { Avatar } from "./Content";
import { TopNav, TopNavHeading, TopNavItem } from "./LayoutPrimitives";

export interface NavItem {
  label: string;
  active?: boolean;
  href?: string;
}

export interface NavProps {
  brand?: string;
  items?: NavItem[];
  cta?: string;
  onCtaClick?: () => void;
  /** The signed-in person; the avatar derives initials from it. */
  userName?: string;
  trailing?: ReactNode;
  showAvatar?: boolean;
}

/** The OpenSeat product bar — an Astryx TopNav with one primary action and the signed-in person. */
export function Nav({ brand = "OpenSeat", items = [], cta, onCtaClick, userName = "Jordan Miles", trailing, showAvatar = false }: NavProps) {
  return (
    <TopNav
      label={brand}
      heading={<TopNavHeading heading={brand} />}
      startContent={
        <>
          {items.map((item) => (
            <TopNavItem key={item.label} label={item.label} href={item.href ?? "#"} isSelected={item.active} />
          ))}
        </>
      }
      endContent={
        <>
          {cta && <Button label={cta} variant="primary" size="sm" onClick={onCtaClick} />}
          {trailing}
          {showAvatar && <Avatar name={userName} size="sm" />}
        </>
      }
    />
  );
}
