"use client";

import { Badge, Icon, TopNav, TopNavHeading, TopNavItem, icons } from "@openseat/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { PostJobButton } from "@/components/post-job-button";
import { COMPANY_UNREAD_MESSAGES } from "@/lib/company";
import { BRAND, ROUTES } from "@/lib/routes";
import { AccountMenu } from "./account-menu";

/** The employer header: brand marked for employers, posting, the company inbox, the account menu. Page nav lives in the rail. */
export function EmployerHeader({ session }: { session: AuthSession | null }) {
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
          <TopNavItem
            label="Messages"
            isIconOnly
            icon={<Icon icon={icons.mail} />}
            href={ROUTES.companyMessages}
          >
            <Badge label={String(COMPANY_UNREAD_MESSAGES)} variant="info" />
          </TopNavItem>
          <AccountMenu mode="company" session={session} />
        </>
      }
    />
  );
}
