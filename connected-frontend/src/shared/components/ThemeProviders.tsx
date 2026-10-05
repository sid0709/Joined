"use client";

import { JoinedProvider, type ColorMode } from "sid-ui/theme";
import NextLink from "next/link";

import type { ReactNode } from "react";

/** Routes every design-system link and button `href` through Next.js so navigation stays client-side. */
export function ThemeProviders({ mode, children }: { mode: ColorMode; children: ReactNode }) {
  return (
    <JoinedProvider mode={mode} linkComponent={NextLink}>
      {children}
    </JoinedProvider>
  );
}
