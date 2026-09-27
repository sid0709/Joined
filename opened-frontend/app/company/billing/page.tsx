import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { BillingWorkspace } from "@/components/company/billing/billing-workspace";
import { PageHeader } from "@/components/page-header";
import { COMPANY_BILLING_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_BILLING_PAGE.label };

export default function BillingPage() {
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
