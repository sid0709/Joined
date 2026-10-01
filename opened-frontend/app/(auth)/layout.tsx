import type { ReactNode } from "react";
import { BrandFooter, BrandLockup, Center, Stack } from "@joined/design-system";
import { BRAND } from "@/lib/routes";

const FORM_WIDTH = 480;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center axis="both" minHeight="100%" padding={6}>
      <Stack width="100%" maxWidth={FORM_WIDTH} gap={6}>
        <BrandLockup product={BRAND} />
        {children}
        <BrandFooter lead={`${BRAND} is part of`} />
      </Stack>
    </Center>
  );
}
