import type { ReactNode } from "react";
import { AppShell, Stack } from "sid-ui";
import { LegalLinks } from "@/components/legal/legal-links";

/** Space around page content, as a spacing step. Sticky panels offset by the same amount. */
export const CONTENT_PADDING = 5;

/** The page frame both modes share; each mode brings its own header. */
export function AppFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <AppShell variant="surface" topNav={header} contentPadding={CONTENT_PADDING}>
      <Stack gap={6}>
        {children}
        <LegalLinks />
      </Stack>
    </AppShell>
  );
}
