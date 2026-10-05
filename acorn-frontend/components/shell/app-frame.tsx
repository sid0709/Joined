import type { ReactNode } from "react";
import { AppShell } from "sid-ui";

const CONTENT_PADDING = 5;

/** The workspace frame: the product bar on top, the page below. No side navigation. */
export function AppFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <AppShell variant="surface" topNav={header} mobileNav={false} contentPadding={CONTENT_PADDING}>
      {children}
    </AppShell>
  );
}
