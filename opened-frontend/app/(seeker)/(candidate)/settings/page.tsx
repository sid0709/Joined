import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { loadSession } from "@/lib/auth/session";
import { SETTINGS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: SETTINGS_PAGE.label };

export default async function SettingsPage() {
  const session = await loadSession();
  return (
    <PageContainer>
      <PageHeader title={SETTINGS_PAGE.label} description={SETTINGS_PAGE.description} />
      <SettingsWorkspace session={session} />
    </PageContainer>
  );
}
