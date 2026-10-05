"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { JoinedProvider } from "sid-ui/theme";
import { CookieConsentBanner } from "@/components/legal/cookie-consent";
import { ModePicker } from "@/components/onboarding/mode-picker";

/**
 * Theme and link wiring for every page. Mode isn't tracked here: each route group
 * — (seeker) and company — renders its own shell, so the URL already says which mode you're in.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <JoinedProvider mode="light" linkComponent={Link}>
      <ModePicker />
      {children}
      <CookieConsentBanner />
    </JoinedProvider>
  );
}
