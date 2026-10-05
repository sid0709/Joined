"use client";

import { Badge, BrandHeading, Button, Glyph, TopNav, useAppShellMobile } from "sid-ui";
import type { AcornAccount } from "@/lib/auth/session";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { WorkspaceNav } from "@/components/workspace/nav";
import { AccountMenu } from "./account-menu";

/** The workspace bar: brand, the page pills, a shortcut to generate, and the account menu. */
export function AcornHeader({ account }: { account: AcornAccount }) {
  const { isMobile } = useAppShellMobile();
  return (
    <TopNav
      label={BRAND}
      heading={
        <BrandHeading
          product={BRAND}
          headingHref={ROUTES.overview}
          headerEndContent={<Badge label="Beta" variant="blue" />}
        />
      }
      centerContent={isMobile ? undefined : <WorkspaceNav />}
      endContent={
        <>
          <Button
            label="New resume"
            variant="primary"
            size="md"
            icon={<Glyph name="sparkle" />}
            isIconOnly={isMobile}
            href={ROUTES.resume}
          />
          <AccountMenu account={account} />
        </>
      }
    />
  );
}
