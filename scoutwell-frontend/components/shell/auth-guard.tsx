"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton, Stack } from "@openseat/design-system";
import { ROUTES, signInHref } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, needsOnboarding } = useScout();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(signInHref(pathname));
      return;
    }
    if (needsOnboarding && pathname !== ROUTES.onboarding) {
      router.replace(ROUTES.onboarding);
    }
  }, [needsOnboarding, pathname, ready, router, user]);

  if (!ready || !user || (needsOnboarding && pathname !== ROUTES.onboarding)) {
    return (
      <Stack gap={4}>
        <Skeleton width="40%" height={28} />
        <Skeleton width="100%" height={180} />
        <Skeleton width="100%" height={240} />
      </Stack>
    );
  }

  return <>{children}</>;
}
