import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { CompanySettings } from "@/components/company/settings/company-settings";
import { PageHeader } from "@/components/page-header";
import { COMPANY_SETTINGS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company settings" };

export default function CompanySettingsPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_SETTINGS_PAGE.label}
        description={COMPANY_SETTINGS_PAGE.description}
      />
      <CompanySettings />
    </Stack>
  );
}
