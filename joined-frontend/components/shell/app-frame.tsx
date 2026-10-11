import type { ReactNode } from "react";
import { AppShell, Stack } from "sid-ui";
import { LegalLinks } from "@/components/legal/legal-links";

/** Space around page content, as a spacing step. Sticky panels offset by the same amount. */
export const CONTENT_PADDING = 5;

/**
 * The page frame both modes share; each mode brings its own header. The column
 * fills the viewport so a short page keeps its footer at the bottom edge instead
 * of floating under the content. The footer sits inside the shell's main region,
 * so it names its landmark itself.
 */
export function AppFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <AppShell variant="surface" topNav={header} contentPadding={CONTENT_PADDING}>
      <Stack gap={6} minHeight="100%" justify="between">
        {children}
        <footer role="contentinfo">
          <LegalLinks />
        </footer>
      </Stack>
    </AppShell>
  );
}
