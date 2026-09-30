"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { OpenSeatProvider, type ColorMode } from "@openseat/design-system/theme";

/** Theme and link wiring for every page. Data comes from Server Components. */
export function Providers({ children, mode }: { children: ReactNode; mode: ColorMode }) {
  return (
    <OpenSeatProvider mode={mode} linkComponent={Link}>
      {children}
    </OpenSeatProvider>
  );
}
