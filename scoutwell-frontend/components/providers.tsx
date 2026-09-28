"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { OpenSeatProvider } from "@openseat/design-system/theme";
import { ScoutProvider } from "@/lib/scout-store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OpenSeatProvider mode="light" linkComponent={Link}>
      <ScoutProvider>{children}</ScoutProvider>
    </OpenSeatProvider>
  );
}
