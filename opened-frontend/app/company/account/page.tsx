import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stack } from "@joined/design-system";
import { AccountWorkspace } from "@/components/company/account/account-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { COMPANY_ACCOUNT_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_ACCOUNT_PAGE.label };

export default async function CompanyAccountPage() {
  const session = await loadSession();
  if (!session) redirect(signInHref(ROUTES.companyAccount));
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_ACCOUNT_PAGE.label}
        description={COMPANY_ACCOUNT_PAGE.description}
      />
      <AccountWorkspace session={session} />
    </Stack>
  );
}
