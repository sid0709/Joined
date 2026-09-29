"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { OpenSeatProvider } from "@openseat/design-system/theme";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OpenSeatProvider mode="light" linkComponent={Link}>
      {children}
    </OpenSeatProvider>
  );
}
