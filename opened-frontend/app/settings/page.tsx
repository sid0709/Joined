import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { SETTINGS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: SETTINGS_PAGE.label };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title={SETTINGS_PAGE.label} description={SETTINGS_PAGE.description} />
      <SettingsWorkspace />
    </PageContainer>
  );
}
