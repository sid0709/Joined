import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PageContainer } from "sid-ui";
import { AcornHeader } from "@/components/shell/acorn-header";
import { AppFrame } from "@/components/shell/app-frame";
import { MobileWorkspaceNav } from "@/components/workspace/nav";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return (
    <AppFrame header={<AcornHeader account={account} />}>
      <PageContainer width="wide">{children}</PageContainer>
      <MobileWorkspaceNav />
    </AppFrame>
  );
}
