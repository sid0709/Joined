import type { ReactNode } from "react";
import { AppShell } from "@openseat/design-system";

export const CONTENT_PADDING = 5;

export function AppFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <AppShell variant="surface" topNav={header} contentPadding={CONTENT_PADDING}>
      {children}
    </AppShell>
  );
}
