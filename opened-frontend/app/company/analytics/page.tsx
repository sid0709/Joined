import type { Metadata } from "next";
import { Stack } from "@joined/design-system";
import { AnalyticsWorkspace } from "@/components/company/analytics/analytics-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { COMPANY_ANALYTICS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_ANALYTICS_PAGE.label };

export default async function AnalyticsPage() {
  const session = await loadSession();
  const company = session?.company;
  if (!company) return null;
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_ANALYTICS_PAGE.label}
        description={COMPANY_ANALYTICS_PAGE.description}
      />
      <AnalyticsWorkspace company={company} />
    </Stack>
  );
}
