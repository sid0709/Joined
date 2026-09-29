import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stack } from "@openseat/design-system";
import { BillingWorkspace } from "@/components/company/billing/billing-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { canManageCompany } from "@/lib/company/access";
import { COMPANY_BILLING_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_BILLING_PAGE.label };

export default async function BillingPage() {
  const session = await loadSession();
  if (!session) redirect(signInHref(ROUTES.companyBilling));
  if (!canManageCompany(session.company)) redirect(ROUTES.company);
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_BILLING_PAGE.label}
        description={COMPANY_BILLING_PAGE.description}
      />
      <BillingWorkspace />
    </Stack>
  );
}
