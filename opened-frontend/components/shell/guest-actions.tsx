"use client";

import { usePathname } from "next/navigation";
import { Button, TopNavItem } from "@openseat/design-system";
import { HIRING_SIGN_UP_HREF, ROUTES, signInHref } from "@/lib/routes";

/** The employer door for signed-out visitors. On phones it lives in the nav drawer instead. */
export function ForEmployersNavItem() {
  return <TopNavItem label="For employers" href={HIRING_SIGN_UP_HREF} />;
}

/**
 * What a signed-out visitor sees on the right: the employer door, sign in, and
 * sign up. Compact on phones, so the bar keeps room for the menu toggle.
 */
export function GuestActions({ isCompact }: { isCompact: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {isCompact ? null : <ForEmployersNavItem />}
      <Button label="Sign in" variant="secondary" size="md" href={signInHref(pathname)} />
      <Button
        label={isCompact ? "Sign up" : "Create account"}
        variant="primary"
        size="md"
        href={ROUTES.signUp}
      />
    </>
  );
}
