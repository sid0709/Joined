import type { ReactNode } from "react";
import { Center, Stack } from "@openseat/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";

const FORM_WIDTH = 480;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppFrame header={<ScoutHeader />}>
      <Center axis="both" minHeight="100%" padding={6}>
        <Stack width="100%" maxWidth={FORM_WIDTH}>
          {children}
        </Stack>
      </Center>
    </AppFrame>
  );
}
