import type { ReactNode } from "react";
import { PageContainer } from "sid-ui";
import { SiteFooter } from "@/components/legal/site-footer";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { loadSession } from "@/lib/auth/session";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  return (
    <AppFrame header={<ScoutHeader user={session?.user ?? null} audience="site" />}>
      <PageContainer>
        {children}
        <SiteFooter />
      </PageContainer>
    </AppFrame>
  );
}
