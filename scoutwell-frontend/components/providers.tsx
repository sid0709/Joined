"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { JoinedProvider, type ColorMode } from "sid-ui/theme";

/** Theme and link wiring for every page. Data comes from Server Components. */
export function Providers({ children, mode }: { children: ReactNode; mode: ColorMode }) {
  return (
    <JoinedProvider mode={mode} linkComponent={Link}>
      {children}
    </JoinedProvider>
  );
}
