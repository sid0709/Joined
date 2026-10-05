import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stack } from "sid-ui";
import { CompanySettings } from "@/components/company/settings/company-settings";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { canOpenCompanySettings } from "@/lib/company/access";
import { COMPANY_SETTINGS_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const session = await loadSession();
  if (!session) redirect(signInHref(ROUTES.companySettings));
  if (!canOpenCompanySettings(session.company)) redirect(ROUTES.company);
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_SETTINGS_PAGE.label}
        description={COMPANY_SETTINGS_PAGE.description}
      />
      <CompanySettings session={session} />
    </Stack>
  );
}
