import type { ReactNode } from "react";
import { AppShell } from "@openseat/design-system";
import { SiteHeader } from "@/components/site-header";

/** Space around page content, as a spacing step. Sticky panels offset by the same amount. */
export const CONTENT_PADDING = 5;

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <AppShell variant="surface" topNav={<SiteHeader />} contentPadding={CONTENT_PADDING}>
      {children}
    </AppShell>
  );
}
