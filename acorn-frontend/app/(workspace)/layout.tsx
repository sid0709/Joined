import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PageContainer, Stack } from "@joined/design-system";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceNav } from "@/components/workspace/nav";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return (
    <PageContainer width="wide">
      <Stack gap={6}>
        <SiteHeader signedIn accountLabel={account.email} />
        <WorkspaceNav />
        {children}
      </Stack>
    </PageContainer>
  );
}
