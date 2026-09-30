"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Icon,
  icons,
  ThemeToggle,
  TopNav,
  TopNavHeading,
  useAppShellMobile,
} from "@openseat/design-system";
import type { SessionUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { AccountMenu } from "./account-menu";
import { CommandMenu } from "./command-menu";
import { ScoutPillNav } from "./scout-pill-nav";

/** The product bar. Signed out it sells; signed in it holds the page pills, search, balance and Submit. */
export function ScoutHeader({
  user = null,
  levelLabel = "",
  unread = 0,
  inReview = 0,
  available = "",
}: {
  user?: SessionUser | null;
  levelLabel?: string;
  unread?: number;
  /** Submissions still being checked or reviewed; badged on the Submissions pill. */
  inReview?: number;
  /** The released balance, already formatted; shown as a shortcut to payouts. */
  available?: string;
}) {
  const router = useRouter();
  const { isMobile } = useAppShellMobile();
  const heading = (
    <TopNavHeading
      heading={BRAND}
      headingHref={user ? ROUTES.dashboard : ROUTES.home}
      headerEndContent={<Badge label="Scouts" variant="blue" />}
    />
  );

  if (!user) {
    return (
      <TopNav
        label={BRAND}
        heading={heading}
        endContent={
          <>
            <ThemeToggle onChange={() => router.refresh()} />
            <Button label="Sign in" variant="ghost" size="sm" href={ROUTES.signIn} />
            <Button label="Become a scout" variant="primary" size="sm" href={ROUTES.signUp} />
          </>
        }
      />
    );
  }

  return (
    <TopNav
      label={BRAND}
      heading={heading}
      startContent={isMobile ? undefined : <ScoutPillNav inReview={inReview} unread={unread} />}
      endContent={
        <>
          <CommandMenu />
          {isMobile || !available ? null : (
            <Button
              label={`Available ${available}`}
              variant="ghost"
              size="sm"
              href={ROUTES.payouts}
            />
          )}
          <Button
            label="Submit a job"
            variant="primary"
            size="sm"
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
