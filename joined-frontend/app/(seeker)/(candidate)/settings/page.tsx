import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { loadSession } from "@/lib/auth/session";
import { isBillingCheckoutEnabled, premiumPrices } from "@/lib/config";
import { loadCalendar, loadSubscription } from "@/lib/me/load";
import { SETTINGS_PAGE, SETTINGS_SECTION_QUERY } from "@/lib/routes";
import { parseSettingsSection } from "@/lib/settings";

export const metadata: Metadata = { title: SETTINGS_PAGE.label };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await loadSession();
  const [calendar, subscription] = await Promise.all([loadCalendar(), loadSubscription()]);
  const params = await searchParams;
  const calendarResult = typeof params.calendar === "string" ? params.calendar : undefined;
  const initialSection = parseSettingsSection(params[SETTINGS_SECTION_QUERY]);
  return (
    <PageContainer>
      <PageHeader title={SETTINGS_PAGE.label} description={SETTINGS_PAGE.description} />
      <SettingsWorkspace
        session={session}
        googleEmail={calendar?.email}
        calendarResult={calendarResult}
        initialSection={initialSection}
        subscription={subscription}
        prices={premiumPrices()}
        checkoutEnabled={isBillingCheckoutEnabled()}
      />
    </PageContainer>
  );
}
