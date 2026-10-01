"use client";

import { Badge, BrandHeading, TopNav } from "@joined/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { PostJobButton } from "@/components/post-job-button";
import { BRAND, ROUTES } from "@/lib/routes";
import { AccountMenu } from "./account-menu";
import { InboxNavItem } from "./inbox-nav-item";

/** The employer header: brand marked for employers, posting, the company inbox, the account menu. Page nav lives in the rail. */
export function EmployerHeader({ session, unread = 0 }: { session: AuthSession; unread?: number }) {
  return (
    <TopNav
      label={`${BRAND} for employers`}
      heading={
        <BrandHeading
          product={BRAND}
          headingHref={ROUTES.company}
          headerEndContent={<Badge label="Employers" variant="blue" />}
        />
      }
      endContent={
        <>
          <PostJobButton size="sm" />
          <InboxNavItem href={ROUTES.companyMessages} unread={unread} />
          <AccountMenu mode="company" session={session} />
        </>
      }
    />
  );
}
