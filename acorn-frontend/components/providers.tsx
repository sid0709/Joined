"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { JoinedProvider } from "@joined/design-system/theme";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <JoinedProvider mode="light" linkComponent={Link}>
      {children}
    </JoinedProvider>
  );
}
