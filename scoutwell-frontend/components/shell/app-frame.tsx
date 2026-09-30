import type { ReactNode } from "react";
import { AppShell } from "@openseat/design-system";

export const CONTENT_PADDING = 5;

/** The page frame. Give it a `nav` and the workspace rail appears; it becomes the drawer on small screens. */
export function AppFrame({
  header,
  nav,
  children,
}: {
  header: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell variant="surface" topNav={header} sideNav={nav} contentPadding={CONTENT_PADDING}>
      {children}
    </AppShell>
  );
}
