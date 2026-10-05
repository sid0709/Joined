import type { ReactNode } from "react";
import { Stack } from "sid-ui";

export const PAGE_MAX_WIDTH = 1200;
/** Workspaces that want the room — search, messages. */
export const WIDE_PAGE_MAX_WIDTH = 1360;

const WIDTHS = { default: PAGE_MAX_WIDTH, wide: WIDE_PAGE_MAX_WIDTH } as const;

/** Centers a page's content at the shared reading width, or the wider workspace width. */
export function PageContainer({
  children,
  width = "default",
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
}) {
  return (
    <Stack hAlign="center">
      <Stack gap={6} maxWidth={WIDTHS[width]} width="100%">
        {children}
      </Stack>
    </Stack>
  );
}
