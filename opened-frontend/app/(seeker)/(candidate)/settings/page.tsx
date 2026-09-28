import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { loadSession } from "@/lib/auth/session";
import { loadCalendar } from "@/lib/me/pipeline";
import { SETTINGS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: SETTINGS_PAGE.label };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await loadSession();
  const calendar = await loadCalendar();
  const params = await searchParams;
  const calendarResult = typeof params.calendar === "string" ? params.calendar : undefined;
  return (
    <PageContainer>
      <PageHeader title={SETTINGS_PAGE.label} description={SETTINGS_PAGE.description} />
      <SettingsWorkspace
        session={session}
        googleEmail={calendar?.email}
        calendarResult={calendarResult}
      />
    </PageContainer>
  );
}
