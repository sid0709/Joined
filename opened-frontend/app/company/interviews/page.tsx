import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { CompanyInterviewsWorkspace } from "@/components/company/interviews/company-interviews-workspace";
import { PageHeader } from "@/components/page-header";
import { COMPANY_INTERVIEWS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company interviews" };

export default function CompanyInterviewsPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_INTERVIEWS_PAGE.label}
        description={COMPANY_INTERVIEWS_PAGE.description}
      />
      <CompanyInterviewsWorkspace />
    </Stack>
  );
}
