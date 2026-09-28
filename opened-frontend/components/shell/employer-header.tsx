"use client";

import { Badge, TopNav, TopNavHeading } from "@openseat/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { PostJobButton } from "@/components/post-job-button";
import { COMPANY_UNREAD_MESSAGES } from "@/lib/company";
import { BRAND, ROUTES } from "@/lib/routes";
import { AccountMenu } from "./account-menu";
import { InboxNavItem } from "./inbox-nav-item";

/** The employer header: brand marked for employers, posting, the company inbox, the account menu. Page nav lives in the rail. */
export function EmployerHeader({ session }: { session: AuthSession }) {
  return (
    <TopNav
      label={`${BRAND} for employers`}
      heading={
        <TopNavHeading
          heading={BRAND}
          headingHref={ROUTES.company}
          headerEndContent={<Badge label="Employers" variant="blue" />}
        />
      }
      endContent={
        <>
          <PostJobButton size="sm" />
          <InboxNavItem href={ROUTES.companyMessages} unread={COMPANY_UNREAD_MESSAGES} />
          <AccountMenu mode="company" session={session} />
        </>
      }
    />
  );
}
