"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  BrandHeading,
  Button,
  Icon,
  icons,
  ThemeToggle,
  TopNav,
  useAppShellMobile,
} from "@joined/design-system";
import type { SessionUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { AccountMenu } from "./account-menu";
import { MarketingNav } from "./marketing-nav";
import { ScoutPillNav } from "./scout-pill-nav";

/** The product bar. Signed out it sells; signed in it holds the page pills and Submit. */
export function ScoutHeader({
  user = null,
  levelLabel = "",
  unread = 0,
  inReview = 0,
  audience = "app",
}: {
  user?: SessionUser | null;
  levelLabel?: string;
  unread?: number;
  /** Submissions still being checked or reviewed; badged on the Submissions pill. */
  inReview?: number;
  /** `site` keeps the public page links in the bar, even when a scout is signed in. */
  audience?: "app" | "site";
}) {
  const router = useRouter();
  const { isMobile } = useAppShellMobile();
  const headingHref = user && audience === "app" ? ROUTES.dashboard : ROUTES.home;
  const heading = (
    <BrandHeading
      product={BRAND}
      headingHref={headingHref}
      headerEndContent={<Badge label="Scouts" variant="blue" />}
    />
  );

  if (!user || audience === "site") {
    return (
      <TopNav
        label={BRAND}
        heading={heading}
        startContent={<MarketingNav />}
        endContent={
          <>
            <ThemeToggle onChange={() => router.refresh()} />
            {user ? (
              <>
                <Button label="Dashboard" variant="primary" size="sm" href={ROUTES.dashboard} />
                <AccountMenu user={user} levelLabel={levelLabel} />
              </>
            ) : (
              <>
                <Button label="Sign in" variant="ghost" size="sm" href={ROUTES.signIn} />
                <Button label="Become a scout" variant="primary" size="sm" href={ROUTES.signUp} />
              </>
            )}
          </>
        }
      />
    );
  }

  return (
    <TopNav
      label={BRAND}
      heading={heading}
      centerContent={isMobile ? undefined : <ScoutPillNav inReview={inReview} unread={unread} />}
      endContent={
        <>
          <Button
            label="Submit a job"
            variant="primary"
            size="md"
            icon={<Icon icon={icons.plus} />}
            isIconOnly={isMobile}
            href={ROUTES.submit}
          />
          <ThemeToggle onChange={() => router.refresh()} />
          <AccountMenu user={user} levelLabel={levelLabel} />
        </>
      }
    />
  );
}
