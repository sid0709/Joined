import type { ReactNode } from "react";
import { Stack } from "@openseat/design-system";

export const PAGE_MAX_WIDTH = 1200;
export const NARROW_PAGE_MAX_WIDTH = 720;

const WIDTHS = { default: PAGE_MAX_WIDTH, narrow: NARROW_PAGE_MAX_WIDTH } as const;

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
