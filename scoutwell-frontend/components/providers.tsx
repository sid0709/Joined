"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { OpenSeatProvider } from "@openseat/design-system/theme";

/** Theme and link wiring for every page. Data comes from Server Components. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <OpenSeatProvider mode="light" linkComponent={Link}>
      {children}
    </OpenSeatProvider>
  );
}
