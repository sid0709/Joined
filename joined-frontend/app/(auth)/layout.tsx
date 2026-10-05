import type { ReactNode } from "react";
import { BrandFooter, BrandLockup, Center, Stack } from "sid-ui";

const FORM_WIDTH = 480;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center axis="both" minHeight="100%" padding={6}>
      <Stack width="100%" maxWidth={FORM_WIDTH} gap={6}>
        <BrandLockup tagline="Find a job, or the people to hire." />
        {children}
        <BrandFooter lead="©" />
      </Stack>
    </Center>
  );
}
