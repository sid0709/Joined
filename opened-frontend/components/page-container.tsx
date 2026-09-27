import type { ReactNode } from "react";
import { Stack } from "@openseat/design-system";

export const PAGE_MAX_WIDTH = 1200;

/** Centers a page's content at the shared reading width. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <Stack hAlign="center">
      <Stack gap={6} maxWidth={PAGE_MAX_WIDTH} width="100%">
        {children}
      </Stack>
    </Stack>
  );
}
