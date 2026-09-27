"use client";

import { Badge, Icon, TopNav, TopNavHeading, TopNavItem, icons } from "@openseat/design-system";
import { AccountMenu } from "@/components/account-menu";
import { useWorkspaceMode } from "@/components/providers";
import { UNREAD_MESSAGES } from "@/lib/account";
import { BRAND, ROUTES } from "@/lib/routes";

export function SiteHeader() {
  const { mode } = useWorkspaceMode();
  const hiring = mode === "company";

  return (
    <TopNav
      label={BRAND}
      heading={<TopNavHeading heading={BRAND} headingHref={ROUTES.search} />}
      startContent={
        <>
          <TopNavItem label="Find jobs" href={ROUTES.search} isSelected={!hiring} />
          <TopNavItem label="Hiring" href={ROUTES.company} isSelected={hiring} />
        </>
      }
      endContent={
        <>
          <TopNavItem
            label="Messages"
            isIconOnly
            icon={<Icon icon={icons.mail} />}
            href={ROUTES.messages}
          >
            <Badge label={String(UNREAD_MESSAGES)} variant="info" />
          </TopNavItem>
          <AccountMenu hiring={hiring} />
        </>
      }
    />
  );
}
