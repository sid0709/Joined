import type { ReactNode } from "react";
import { Center, Stack } from "@joined/design-system";

const FORM_WIDTH = 480;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center axis="both" minHeight="100%" padding={6}>
      <Stack width="100%" maxWidth={FORM_WIDTH}>
        {children}
      </Stack>
    </Center>
  );
}
