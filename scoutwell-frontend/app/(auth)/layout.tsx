import type { ReactNode } from "react";
import { Center, Stack } from "@openseat/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { loadSession } from "@/lib/auth/session";

const FORM_WIDTH = 520;

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  return (
    <AppFrame header={<ScoutHeader user={session?.user ?? null} />}>
      <Center axis="both" minHeight="100%" padding={6}>
        <Stack width="100%" maxWidth={FORM_WIDTH}>
          {children}
        </Stack>
      </Center>
    </AppFrame>
  );
}
