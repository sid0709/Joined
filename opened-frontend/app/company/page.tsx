import type { Metadata } from "next";
import { Stack, Text } from "@openseat/design-system";
import { CompanyStats } from "@/components/company-stats";
import { PageHeader } from "@/components/page-header";
import { PostJobButton } from "@/components/post-job-button";
import { BILLING, formatCents } from "@/lib/account";
import { COMPANY_HOME_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Hiring" };

export default function CompanyHomePage() {
  return (
    <Stack gap={5}>
      <PageHeader title={COMPANY_HOME_PAGE.label} description={COMPANY_HOME_PAGE.description} action={<PostJobButton />} />
      <CompanyStats />
      <Text color="secondary" display="block">
        Cap {formatCents(BILLING.capCents, BILLING.currency)} · {BILLING.freeInterviewsRemaining} free interviews left on the {BILLING.plan} plan.
      </Text>
    </Stack>
  );
}
