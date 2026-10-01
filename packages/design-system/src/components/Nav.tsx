"use client";

import { BRAND_NAME, BrandHeading } from "../brand";

import { Button } from "./Action";
import { Avatar } from "./Content";
import { TopNav, TopNavItem } from "./LayoutPrimitives";

import type { ReactNode } from "react";

export interface NavItem {
  label: string;
  active?: boolean;
  href?: string;
}

export interface NavProps {
  /** Product name. The bare brand renders as the wordmark; a sub-product gets the app icon and its name. */
  brand?: string;
  items?: NavItem[];
  cta?: string;
  onCtaClick?: () => void;
  /** The signed-in person; the avatar derives initials from it. */
  userName?: string;
  /** Optional route for the signed-in person's profile. */
  userHref?: string;
  trailing?: ReactNode;
  showAvatar?: boolean;
}

/** The Joined product bar — an Astryx TopNav with one primary action and the signed-in person. */
export function Nav({
  brand = BRAND_NAME,
  items = [],
  cta,
  onCtaClick,
  userName = "Jordan Miles",
  userHref,
  trailing,
  showAvatar = false,
}: NavProps) {
  return (
    <TopNav
      label={brand}
      heading={<BrandHeading product={brand} />}
      startContent={
        <>
          {items.map((item) => (
            <TopNavItem
              key={item.label}
              label={item.label}
              href={item.href ?? "#"}
              isSelected={item.active}
            />
          ))}
        </>
      }
      endContent={
        <>
          {cta && <Button label={cta} variant="primary" size="sm" onClick={onCtaClick} />}
          {trailing}
          {showAvatar && (
            <Avatar name={userName} alt={`${userName} profile`} href={userHref} size="sm" />
          )}
        </>
      }
    />
  );
}
