"use client";

import { useLinkComponent } from "@astryxdesign/core/Link";
import { Tooltip } from "@astryxdesign/core/Tooltip";

import { Glyph, type GlyphName } from "./Glyph";

/** Larger counts read as "99+" so the bubble stays small. */
const MAX_COUNT = 99;

export type PillNavItem = {
  href: string;
  label: string;
  icon: GlyphName;
  /** Unread or pending count; hidden at zero. */
  count?: number;
};

export type PillNavProps = {
  items: PillNavItem[];
  /** The href of the current page; that pill opens to show its label. */
  activeHref?: string;
  /** Names the navigation landmark. */
  label: string;
  /** `top` sits in a header; `bottom` is a fixed bar for small screens. */
  placement?: "top" | "bottom";
};

/**
 * App navigation as a row of pills: each page is an icon, and the page you are on opens to
 * icon + label in the accent colour. The label slides open on its natural width, no measuring.
 */
export function PillNav({ items, activeHref, label, placement = "top" }: PillNavProps) {
  const LinkComponent = useLinkComponent();
  const nav = (
    <nav aria-label={label} className="os-pill-nav" data-placement={placement}>
      <ul className="os-pill-list">
        {items.map((item) => {
          const isActive = item.href === activeHref;
          const count = item.count && item.count > 0 ? item.count : 0;
          const pill = (
            <LinkComponent
              href={item.href}
              className="os-pill"
              aria-current={isActive ? "page" : undefined}
              aria-label={count ? `${item.label}, ${count}` : item.label}
            >
              <span className="os-pill-icon">
                <Glyph name={item.icon} />
                {count ? (
                  <span className="os-pill-count" aria-hidden>
                    {count > MAX_COUNT ? `${MAX_COUNT}+` : count}
                  </span>
                ) : null}
              </span>
              <span className="os-pill-label" aria-hidden>
                <span>{item.label}</span>
              </span>
            </LinkComponent>
          );
          return (
            <li key={item.href}>
              {isActive ? pill : <Tooltip content={item.label}>{pill}</Tooltip>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
  // A fixed bottom bar would cover the end of the page; the spacer keeps that content reachable.
  return placement === "bottom" ? (
    <>
      <div className="os-pill-nav-spacer" aria-hidden />
      {nav}
    </>
  ) : (
    nav
  );
}
