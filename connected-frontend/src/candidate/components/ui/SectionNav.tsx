"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

export interface SectionLink {
  label: string;
  href: string;
  count?: number;
}

export const PIPELINE_LINKS: SectionLink[] = [
  { label: "Pipeline", href: BIDDER_ROUTES.pipeline },
  { label: "Invitations", href: BIDDER_ROUTES.invitations },
  { label: "Interviews", href: BIDDER_ROUTES.interviews },
];

export const ACCOUNT_LINKS: SectionLink[] = [
  { label: "Profile", href: BIDDER_ROUTES.profile },
  { label: "Assessments", href: BIDDER_ROUTES.assessments },
  { label: "Notifications", href: BIDDER_ROUTES.notifications },
];

export const MONEY_LINKS: SectionLink[] = [
  { label: "Earnings", href: BIDDER_ROUTES.earnings },
  { label: "Performance", href: BIDDER_ROUTES.performance },
];

export function SectionNav({ links, label }: { links: SectionLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav className="bx-subnav" aria-label={label}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="bx-subnav-link"
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
          {link.count ? <span className="hx-unread">{link.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
