import type { ReactNode } from "react";
import { Stack } from "sid-ui";
import { AuthAside } from "@/components/auth/auth-aside";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { loadSession } from "@/lib/auth/session";

const FORM_WIDTH = 480;

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  return (
    <AppFrame header={<ScoutHeader user={session?.user ?? null} audience="site" />}>
      <div className="sw-auth">
        <AuthAside />
        <div className="sw-auth-main">
          <Stack width="100%" maxWidth={FORM_WIDTH}>
            <div className="sw-rise">{children}</div>
          </Stack>
        </div>
      </div>
    </AppFrame>
  );
}
